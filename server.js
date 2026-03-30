// CERBERUS BACKEND — OPTIMISED + CLEAN

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json({ limit: '10kb' }));

const API_KEY = "vX#9kR$2mP@8nQ!4wL&7dY%3jT*6bF^1";

app.get('/', (_req, res) => res.send('online'));

function broadcast(obj) {
    const buf = Buffer.from(JSON.stringify(obj));
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(buf);
        }
    }
}

const jobPresence = {};

wss.on('connection', (ws, req) => {
    // Key passed as query param: wss://url?key=...
    const params = new URLSearchParams(req.url.replace(/^\/?/, '').replace(/^[^?]*\??/, ''));
    if (params.get('key') !== API_KEY) {
        ws.close(4001, 'Unauthorized');
        return;
    }

    let _username = null;
    let _jobId    = null;

    ws.on('message', data => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'presence_join' && msg.username && msg.job_id) {
            _username = msg.username;
            _jobId    = msg.job_id;
            if (jobPresence[_jobId]) {
                for (const existingUser of jobPresence[_jobId]) {
                    if (existingUser !== _username) {
                        ws.send(JSON.stringify({ type: 'presence_join', username: existingUser, job_id: _jobId }));
                    }
                }
            }
            if (!jobPresence[_jobId]) jobPresence[_jobId] = new Set();
            jobPresence[_jobId].add(_username);
            broadcast({ type: 'presence_join', username: _username, job_id: _jobId });
            return;
        }

        broadcast(msg);
    });

    ws.on('close', () => {
        if (_username && _jobId) {
            if (jobPresence[_jobId]) {
                jobPresence[_jobId].delete(_username);
                if (jobPresence[_jobId].size === 0) delete jobPresence[_jobId];
            }
            broadcast({ type: 'presence_leave', username: _username, job_id: _jobId });
        }
    });
});

app.post('/submit', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
    const b = req.body;
    if (!b?.name) return res.status(400).json({ error: 'Missing name' });
    broadcast({
        type:     "brainrot",
        name:     b.name,
        gen:      b.gen      || "?",
        mutation: b.mutation || "None",
        value:    b.value    || 0,
        job_id:   b.job_id   || "",
        place_id: b.place_id || ""
    });
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Cerberus backend running on port", PORT));

setInterval(() => {
    const buf = Buffer.from(JSON.stringify({ type: "ping" }));
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(buf);
    }
}, 20000);
