function csv(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function buildPatreonAuthorizeUrl(env, state) {
  const url = new URL(env.PATREON_AUTHORIZE_URL || 'https://www.patreon.com/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.PATREON_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.PATREON_REDIRECT_URI);
  url.searchParams.set('scope', env.PATREON_SCOPES || 'identity identity[email] identity.memberships');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForToken(env, code) {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('client_id', env.PATREON_CLIENT_ID);
  body.set('client_secret', env.PATREON_CLIENT_SECRET);
  body.set('redirect_uri', env.PATREON_REDIRECT_URI);

  const res = await fetch(env.PATREON_TOKEN_URL || 'https://www.patreon.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Patreon token error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function fetchPatreonIdentity(env, accessToken) {
  const base = env.PATREON_IDENTITY_URL || 'https://www.patreon.com/api/oauth2/v2/identity';
  const url = new URL(base);
  url.searchParams.set('fields[user]', 'full_name,email');
  url.searchParams.set('include', 'memberships,memberships.currently_entitled_tiers,memberships.campaign');
  url.searchParams.set('fields[member]', 'patron_status,currently_entitled_amount_cents,last_charge_status');
  url.searchParams.set('fields[tier]', 'title,amount_cents');
  url.searchParams.set('fields[campaign]', 'summary');

  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Patreon identity error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export function evaluateEntitlement(env, identity) {
  const allowedTierIds = csv(env.PATREON_ALLOWED_TIER_IDS);
  const allowedCampaignIds = csv(env.PATREON_ALLOWED_CAMPAIGN_IDS);
  const requireActive = String(env.PATREON_REQUIRE_ACTIVE_STATUS || 'true').toLowerCase() !== 'false';
  const included = Array.isArray(identity?.included) ? identity.included : [];
  const user = identity?.data || {};
  const members = included.filter((x) => x.type === 'member');
  const tiersById = new Map(included.filter((x) => x.type === 'tier').map((x) => [String(x.id), x]));
  const campaignsById = new Map(included.filter((x) => x.type === 'campaign').map((x) => [String(x.id), x]));

  const matches = [];
  for (const member of members) {
    const attrs = member.attributes || {};
    const patronStatus = attrs.patron_status || null;
    if (requireActive && patronStatus && patronStatus !== 'active_patron') continue;

    const campaignId = member.relationships?.campaign?.data?.id || null;
    if (allowedCampaignIds.length && (!campaignId || !allowedCampaignIds.includes(String(campaignId)))) continue;

    const tierRefs = member.relationships?.currently_entitled_tiers?.data || [];
    for (const tierRef of tierRefs) {
      const tierId = String(tierRef.id);
      if (allowedTierIds.length && !allowedTierIds.includes(tierId)) continue;
      const tier = tiersById.get(tierId);
      const campaign = campaignId ? campaignsById.get(String(campaignId)) : null;
      matches.push({
        tier_id: tierId,
        tier_title: tier?.attributes?.title || null,
        amount_cents: tier?.attributes?.amount_cents ?? null,
        campaign_id: campaignId,
        campaign_summary: campaign?.attributes?.summary || null,
        patron_status: patronStatus,
        last_charge_status: attrs.last_charge_status || null
      });
    }
  }

  return {
    allowed: matches.length > 0,
    user: {
      patreon_user_id: user.id || null,
      full_name: user.attributes?.full_name || null,
      email: user.attributes?.email || null
    },
    entitlements: matches,
    reason: matches.length ? 'tier_allowed' : 'no_allowed_tier'
  };
}
