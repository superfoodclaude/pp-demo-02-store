# pp-demo-02-store

Plumbing & Porcelain demo — Shopify **Hydrogen** storefront, deployed to Cloudflare Workers at
[pp-demo-02-store.cameron-e04.workers.dev](https://pp-demo-02-store.cameron-e04.workers.dev).

Scaffolded from the Hydrogen skeleton template (React Router + Vite), linked to the
`pp-demo-02.myshopify.com` development store. The one product is
[**Loam Self-Watering Ceramic Planter, 6"**](https://pp-demo-02-store.cameron-e04.workers.dev/products/loam-self-watering-planter)
— $48.00, placeholder image.

## The demo: Script B

`app/lib/click-linker.server.ts` is **Script B**, copied verbatim from the kit. It is called from
the root loader in [`app/root.tsx`](app/root.tsx):

```ts
const headers = new Headers();
const setCookieValue = maybeSetClickCookie(args.request);
if (setCookieValue) headers.append('Set-Cookie', setCookieValue);
return data({...}, {headers});
```

On every request it looks for a click ID in the URL (`gclid`, `__gclid`, `gbraid`, `wbraid`,
`fbclid`). If one is present it writes the first-party `_pp_click` cookie —
`Path=/; Max-Age=90d; SameSite=Lax; Secure`, **no `Domain` attribute**, so the cookie is host-only.
`__gclid` (the TPV's renamed carrier) is restored to `gclid` before anything downstream sees it.
If no click ID is present, no `Set-Cookie` header is sent at all, so an existing cookie survives
param-less navigation untouched.

The inbound half of the hop lives in the companion repo
[pp-demo-02-tpv](https://github.com/superfoodclaude/pp-demo-02-tpv), whose single
`a[data-pp-outbound]` CTA points here.

## Configuration

| Where | What |
| --- | --- |
| `wrangler.toml` `[vars]` | Public identifiers only — store domain, storefront ID, customer-account API client ID/URL. Committed. |
| GitHub Actions secrets | `PUBLIC_STOREFRONT_API_TOKEN`, `PRIVATE_STOREFRONT_API_TOKEN`, `SESSION_SECRET`, plus Cloudflare credentials. Synced onto the Worker by CI after each deploy. |
| `.env` | Local only, written by `npx shopify hydrogen env pull`. Gitignored, never committed. |

## Deploying

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, `npm run build`,
`npx wrangler deploy`, then `wrangler secret bulk` to sync the runtime secrets.

## Local development

```bash
npx shopify hydrogen env pull --env production   # writes .env
npm install
npm run dev
```
