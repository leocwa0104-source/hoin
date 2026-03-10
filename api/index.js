const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const tencentcloud = require('tencentcloud-sdk-slim-nodejs');
const fs = require('fs');
const path = require('path');
const { query } = require('./db');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const sha256 = (input) => crypto.createHash('sha256').update(input).digest('hex');

const randomToken = () => {
    const buf = crypto.randomBytes(32);
    if (typeof buf.toString === 'function') return buf.toString('base64url');
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const parseCookies = (cookieHeader) => {
    const result = {};
    if (!cookieHeader) return result;
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key) continue;
        result[key] = decodeURIComponent(value);
    }
    return result;
};

const setSessionCookie = (res, token, maxAgeSeconds) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`);
};

const clearSessionCookie = (res) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
};

const getSesClient = () => {
    if (global.__sesClient) return global.__sesClient;
    const secretId = process.env.TENCENTCLOUD_SECRET_ID;
    const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
    const region = process.env.TENCENTCLOUD_REGION || 'ap-guangzhou';
    if (!secretId || !secretKey) {
        throw new Error('Missing TENCENTCLOUD_SECRET_ID or TENCENTCLOUD_SECRET_KEY');
    }
    const SesClient = tencentcloud.ses.v20201002.Client;
    global.__sesClient = new SesClient({
        credential: { secretId, secretKey },
        region,
        profile: { httpProfile: { endpoint: 'ses.tencentcloudapi.com' } },
    });
    return global.__sesClient;
};

const ensureSchema = async () => {
    if (global.__schemaReady) return;
    try {
        await query('SELECT 1 FROM email_otps LIMIT 1');
        global.__schemaReady = true;
        return;
    } catch (e) { void e; }
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await query(sql);
    global.__schemaReady = true;
};

const pointInRing = (point, ring) => {
    const x = point[0];
    const y = point[1];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

const pointInPolygon = (point, polygon) => {
    if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
        return false;
    }
    const [outerRing, ...holes] = polygon.coordinates;
    if (!pointInRing(point, outerRing)) return false;
    for (const hole of holes) {
        if (pointInRing(point, hole)) return false;
    }
    return true;
};

const getPolygonBbox = (geometry) => {
    if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
        return null;
    }
    const ring = geometry.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 3) return null;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const p of ring) {
        const lng = Number(p[0]);
        const lat = Number(p[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
    }
    return { minLng, minLat, maxLng, maxLat };
};

const requireAuth = async (req, res, next) => {
    try {
        const cookies = parseCookies(req.headers.cookie);
        const token = cookies.session;
        if (!token) return res.status(401).json({ error: 'unauthorized' });
        const sessionSecret = process.env.SESSION_SECRET;
        if (!sessionSecret) return res.status(500).json({ error: 'missing_session_secret' });
        const tokenHash = sha256(`${sessionSecret}:${token}`);
        const result = await query(
            `SELECT u.id, u.email
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = $1 AND s.expires_at > now()
             LIMIT 1`,
            [tokenHash]
        );
        if (result.rows.length === 0) return res.status(401).json({ error: 'unauthorized' });
        req.user = result.rows[0];
        next();
    } catch (err) {
        next(err);
    }
};

app.get('/api', (req, res) => {
    res.send("GeoChat API is running");
});

app.get('/api/me', requireAuth, async (req, res) => {
    res.json({ id: req.user.id, email: req.user.email });
});

app.post('/api/auth/request-otp', async (req, res, next) => {
    try {
        await ensureSchema();
        const otpSecret = process.env.OTP_SECRET;
        if (!otpSecret) return res.status(500).json({ error: 'missing_otp_secret' });

        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const codeHash = sha256(`${email}:${code}:${otpSecret}`);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await query('DELETE FROM email_otps WHERE email = $1', [email]);
        await query(
            'INSERT INTO email_otps (email, code_hash, expires_at) VALUES ($1, $2, $3)',
            [email, codeHash, expiresAt]
        );

        const fromEmail = process.env.FROM_EMAIL;
        const senderDomain = process.env.SENDER_DOMAIN;
        const fromLocalPart = process.env.FROM_LOCAL_PART || 'noreply';
        const from = fromEmail || (senderDomain ? `${fromLocalPart}@${senderDomain}` : '');
        if (!from) return res.status(500).json({ error: 'missing_from_email' });

        const client = getSesClient();
        const templateIdRaw = String(process.env.SES_TEMPLATE_ID || '').trim();
        const templateId = templateIdRaw ? Number(templateIdRaw) : 0;
        const payload = {
            FromEmailAddress: from,
            Destination: [email],
            Subject: 'GeoChat 验证码',
        };
        if (templateId && Number.isFinite(templateId)) {
            payload.Template = {
                TemplateID: templateId,
                TemplateData: JSON.stringify({ code }),
            };
        } else {
            payload.Simple = {
                Text: { Charset: 'UTF-8', Data: `你的验证码是：${code}。15 分钟内有效。如非本人操作请忽略。` },
            };
        }
        await client.SendEmail(payload);

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/register', async (req, res, next) => {
    try {
        await ensureSchema();
        const otpSecret = process.env.OTP_SECRET;
        const sessionSecret = process.env.SESSION_SECRET;
        if (!otpSecret) return res.status(500).json({ error: 'missing_otp_secret' });
        if (!sessionSecret) return res.status(500).json({ error: 'missing_session_secret' });

        const email = String(req.body?.email || '').trim().toLowerCase();
        const code = String(req.body?.code || '').trim();
        const password = String(req.body?.password || '');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
        if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'invalid_code' });
        if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });

        const otpRes = await query(
            `SELECT id, code_hash, expires_at, attempts
             FROM email_otps
             WHERE email = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [email]
        );
        if (otpRes.rows.length === 0) return res.status(400).json({ error: 'code_not_found' });
        const otpRow = otpRes.rows[0];
        if (new Date(otpRow.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'code_expired' });
        if (Number(otpRow.attempts) >= 5) return res.status(400).json({ error: 'too_many_attempts' });

        const expectedHash = sha256(`${email}:${code}:${otpSecret}`);
        if (expectedHash !== otpRow.code_hash) {
            await query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [otpRow.id]);
            return res.status(400).json({ error: 'code_invalid' });
        }

        const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
        if (existing.rows.length > 0) return res.status(409).json({ error: 'email_in_use' });

        const passwordHash = await bcrypt.hash(password, 10);
        const userRes = await query(
            `INSERT INTO users (email, password_hash, email_verified_at)
             VALUES ($1, $2, now())
             RETURNING id, email`,
            [email, passwordHash]
        );
        await query('DELETE FROM email_otps WHERE email = $1', [email]);

        const token = randomToken();
        const tokenHash = sha256(`${sessionSecret}:${token}`);
        const maxAgeSeconds = 30 * 24 * 60 * 60;
        const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
        await query(
            `INSERT INTO sessions (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userRes.rows[0].id, tokenHash, expiresAt]
        );
        setSessionCookie(res, token, maxAgeSeconds);
        res.json(userRes.rows[0]);
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/login', async (req, res, next) => {
    try {
        await ensureSchema();
        const sessionSecret = process.env.SESSION_SECRET;
        if (!sessionSecret) return res.status(500).json({ error: 'missing_session_secret' });

        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
        if (!password) return res.status(400).json({ error: 'invalid_password' });

        const userRes = await query('SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1', [email]);
        if (userRes.rows.length === 0) return res.status(401).json({ error: 'invalid_credentials' });

        const ok = await bcrypt.compare(password, userRes.rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

        const token = randomToken();
        const tokenHash = sha256(`${sessionSecret}:${token}`);
        const maxAgeSeconds = 30 * 24 * 60 * 60;
        const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);
        await query(
            `INSERT INTO sessions (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [userRes.rows[0].id, tokenHash, expiresAt]
        );
        setSessionCookie(res, token, maxAgeSeconds);
        res.json({ id: userRes.rows[0].id, email: userRes.rows[0].email });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
    try {
        const cookies = parseCookies(req.headers.cookie);
        const token = cookies.session;
        const sessionSecret = process.env.SESSION_SECRET;
        if (token && sessionSecret) {
            const tokenHash = sha256(`${sessionSecret}:${token}`);
            await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
        }
        clearSessionCookie(res);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

app.get('/api/areas', requireAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, name, geometry, created_at
             FROM areas
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows.map((r) => ({ ...r, createdAt: r.created_at })));
    } catch (err) {
        next(err);
    }
});

app.post('/api/areas', requireAuth, async (req, res, next) => {
    try {
        const name = String(req.body?.name || '').trim();
        const geometry = req.body?.geometry;
        if (!name || !geometry) return res.status(400).json({ error: 'missing_data' });

        const bbox = getPolygonBbox(geometry);
        if (!bbox) return res.status(400).json({ error: 'invalid_geometry' });

        const result = await query(
            `INSERT INTO areas (user_id, name, geometry, bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat)
             VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
             RETURNING id, name, geometry, created_at`,
            [req.user.id, name, JSON.stringify(geometry), bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
        );
        const row = result.rows[0];
        res.json({ ...row, createdAt: row.created_at });
    } catch (err) {
        next(err);
    }
});

app.post('/api/messages', requireAuth, async (req, res, next) => {
    try {
        const content = String(req.body?.content || '').trim();
        const lat = req.body?.lat;
        const lng = req.body?.lng;
        if (!content || lat === undefined || lng === undefined) return res.status(400).json({ error: 'missing_data' });
        const latNum = Number(lat);
        const lngNum = Number(lng);
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return res.status(400).json({ error: 'invalid_location' });

        await query(
            `INSERT INTO messages (sender_id, content, lng, lat)
             VALUES ($1, $2, $3, $4)`,
            [req.user.id, content, lngNum, latNum]
        );
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

app.get('/api/areas/:areaId/messages', requireAuth, async (req, res, next) => {
    try {
        const areaId = req.params.areaId;
        const areaRes = await query(
            `SELECT id, geometry, bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat
             FROM areas
             WHERE id = $1 AND user_id = $2
             LIMIT 1`,
            [areaId, req.user.id]
        );
        if (areaRes.rows.length === 0) return res.status(404).json({ error: 'area_not_found' });
        const area = areaRes.rows[0];
        const geometry = area.geometry;

        const msgRes = await query(
            `SELECT id, sender_id, content, lng, lat, created_at
             FROM messages
             WHERE lng >= $1 AND lng <= $2 AND lat >= $3 AND lat <= $4
             ORDER BY created_at ASC
             LIMIT 200`,
            [area.bbox_min_lng, area.bbox_max_lng, area.bbox_min_lat, area.bbox_max_lat]
        );
        const filtered = [];
        for (const m of msgRes.rows) {
            const pt = [Number(m.lng), Number(m.lat)];
            if (pointInPolygon(pt, geometry)) {
                filtered.push({
                    id: m.id,
                    senderId: m.sender_id,
                    content: m.content,
                    location: { lng: Number(m.lng), lat: Number(m.lat) },
                    createdAt: m.created_at,
                });
            }
        }
        res.json(filtered.slice(-50));
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, _next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
