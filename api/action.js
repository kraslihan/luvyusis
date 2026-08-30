import { getState, saveState, resolveRole } from '../lib/kv.js';
import { otherOf, buildPartnerView, applyAction } from '../lib/domain.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  const role = resolveRole(req);
  if (!role) { res.status(401).json({ error: 'invalid_token' }); return; }

  const { type, payload } = req.body || {};
  if (!type) { res.status(400).json({ error: 'missing_type' }); return; }

  try {
    const state = await getState();
    applyAction(state, role, type, payload || {});
    await saveState(state);

    const other = otherOf(role);
    res.status(200).json({
      role,
      onboarded: state.onboarded[role],
      me: state.users[role],
      partner: buildPartnerView(state, other),
      shared: state.shared,
    });
  } catch (err) {
    const code = err && err.statusCode ? err.statusCode : 500;
    res.status(code).json({ error: code === 400 ? 'bad_request' : 'server_error', message: String(err && err.message || err) });
  }
}
