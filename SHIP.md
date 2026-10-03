# Shipping Overload to the App Store

Everything here is scripted. The only manual step is the first one, because the
signing key cannot be copied automatically.

## 0. Put the credentials in place (manual, one line)

The App Store Connect API key and the Expo auth token live in the QR Forge
project. Copy them across:

```bash
mkdir -p "D:/StrongAlternative/credentials" && cp "C:/Users/Hasan/Desktop/fable 5/QR-Code-Generator/credentials/asckey.p8" "D:/StrongAlternative/credentials/asckey.p8" && cp "C:/Users/Hasan/Desktop/fable 5/QR-Code-Generator/.expotoken" "D:/StrongAlternative/.expotoken"
```

Both are gitignored and must never be committed.

## 1. Signing credentials

Registers the bundle id `com.hasanzafar.overload`, creates a distribution
certificate and an App Store provisioning profile, and writes
`credentials.json`. No interactive Apple login.

```bash
node scripts/gen-ios-creds.mjs
```

EAS Build cannot create these non-interactively from environment variables — it
fails with "Distribution Certificate is not validated for non-interactive
builds" — which is why they are made here and handed to EAS as local
credentials.

## 2. EAS project

```bash
npx eas-cli@latest init --non-interactive --force
```

Then put the returned project id into `app.json` under
`expo.extra.eas.projectId` (it is currently a placeholder of zeros).

## 3. Build

```bash
npx eas-cli@latest build --platform ios --profile production --non-interactive
```

## 4. Create the App Store record — web UI only

**The App Store Connect API cannot create an app.** `POST /v1/apps` returns

    403 The resource 'apps' does not allow 'CREATE'.
    Allowed operations are: GET_COLLECTION, GET_INSTANCE, UPDATE

and the `iris` endpoint that older notes referred to rejects the API-key JWT
outright ("No valid credentials found in the request") — it wants a browser
session. `scripts/asc-create-app.mjs` tries both and will happily pick up an
existing record, but the record itself has to be made once by hand at
appstoreconnect.apple.com → Apps → **+** → New App:

| Field | Value |
|---|---|
| Platform | iOS |
| Name | from `store/metadata.mjs` |
| Primary Language | English (U.S.) |
| Bundle ID | com.hasanzafar.overload |
| SKU | OVERLOAD2026 |
| User Access | Full Access |

Note that the dialog is a React form that ignores programmatically set values:
driving it needs real clicks and keystrokes, and the two dropdowns respond to
click-then-type rather than to setting `value`.

Then record the id and push the listing:

```bash
node scripts/asc-create-app.mjs
```

```bash
node scripts/check-metadata.mjs && node scripts/asc-metadata.mjs
```

## 4b. App Privacy — web UI only, and it blocks review

App Review rejects the submission with `APP_DATA_USAGES_REQUIRED` until the
privacy answers are *published*. Like app creation, this is not in the public
API at all — every one of these 404s:

    /v1/apps/{id}/appDataUsages
    /v1/apps/{id}/appDataUsagesPublishState
    /v1/appDataUsageCategories
    /v1/appDataUsageDataProtections

Do it at Distribution → App Privacy → Data Collection → **Get Started** →
"No, we do not collect data from this app" → Save → **Publish**. The Publish
step is separate from Save and is the one that actually clears the blocker.

## 5. Availability — do not skip this

```bash
node scripts/asc-availability.mjs
```

A newly created app has **no** `appAvailabilities` record at all, and setting a
price does not create one. Without this step the app can be approved, sit at
READY_FOR_SALE, and still be on sale in zero territories with every storefront
reporting "not available in this region". Nothing in the submit flow warns you.
Verify with `GET /v2/appAvailabilities/{appId}` — a 404 means on sale nowhere.

## 6. Screenshots

```bash
node --experimental-strip-types scripts/make-demo.mjs && cp .scratch/demo-db.json public/demo-db.json
```

```bash
npx expo start --web --port 8099
```

```bash
node scripts/make-screenshots.mjs && node scripts/asc-screenshots.mjs
```

The screenshots are captured from the real running app, loaded with six
months of generated training run through the real CSV importer, and driven
with real clicks and typing. Two sets are required: `APP_IPHONE_67` (there is
no `APP_IPHONE_69` type, so the 1320×2868 assets go here) and `APP_IPHONE_65`.
The app is iPhone-only (`supportsTablet: false`), so no iPad set is needed.

Uploading is additive, so `asc-screenshots.mjs` now clears each set first. It
did not originally, and a second run left a duplicate in the 6.7" set with the
wrong image first on the store page — which cannot be fixed afterwards, because
Apple refuses both deletes and reorders once the version is submitted
("Can't Reorder Assets after Submission"). Recovering meant cancelling the
review submission, fixing, and resubmitting.

## 7. Submit

```bash
npx eas-cli@latest submit --platform ios --profile production --non-interactive
```

```bash
node scripts/asc-submit.mjs
```

## Known gotchas, learned the hard way

- `whatsNew` returns 409 on a first version; only send it when the version
  string is not `1.0`.
- `ageRatingDeclaration` attributes are all null on a fresh app and mix boolean
  and enum types. `asc-metadata.mjs` self-corrects from the API's own type
  errors, retrying up to six times.
- Submission blockers surface only as `associatedErrors` on
  `POST /v1/reviewSubmissionItems`: app pricing, `contentRightsDeclaration`, and
  the four review contact fields.
- Price points live at `/v1/apps/{id}/appPricePoints?filter[territory]=USA`.
  `GET /v1/apps/{id}/appPriceSchedule` returns a stub for every app, so check
  `appPriceSchedules/{id}/manualPrices` to know whether a price is really set.
- Guideline 2.3.7: no price references outside the description. The description
  is the only place the word "free" may appear. `check-metadata.mjs` enforces
  this.
- The age rating PATCH 409s with `KOREA_AGE_RATING_OVERRIDE_INVALID` if
  `gracRatingClassificationNumber` is sent while `koreaAgeRatingOverride` is
  NONE. That key is now in `SKIP_KEYS`.
- Categories are read from `store/metadata.mjs`; they used to be hardcoded, so
  a copied script will silently file the app under the wrong category.

## Learned on this app (Oct 2026)

- **expo-notifications adds `aps-environment` even when only local
  notifications are used.** Expo applies its config plugin automatically once
  the package is installed. A provisioning profile for a bundle id without
  the Push Notifications capability then fails to sign it, so
  `gen-ios-creds.mjs` enables `PUSH_NOTIFICATIONS` on the bundle id before
  making the profile. Check with `npx expo config --type introspect`.
- **Availability is applied asynchronously.** Straight after the POST,
  `/v2/appAvailabilities/{id}` reads back 0 territories; a minute later it
  shows all 175. The script now polls instead of reporting 0.
- **`File.move` is asynchronous in expo-file-system 57.** Not awaiting it lost
  saves on device (the browser build uses localStorage and cannot show it).
  `scripts/test-storage.mjs` runs the storage class against a fake filesystem
  with the same async, no-clobber move.
- The App Store Connect New App dialog: text fields take real clicks and
  typing; the two dropdowns need click, type the option text, then Return.
  Setting their value programmatically is ignored.

## This app

- App Store Connect id **6818696263** (also in `.ascappid`)
- Bundle `com.hasanzafar.overload` (bundle id record 5TTGQ6J48P), SKU `OVERLOAD2026`
- EAS project `2e944a56-169c-4a78-8d75-638dc90cac87`
- Distribution certificate DNL88X8YD9, provisioning profile GPU763T4X9
