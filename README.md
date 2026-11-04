# Wizytówka + prywatny panel Cloudflare

Publiczna strona `index.html` działa na GitHub Pages. Ustawienia profilu są zapisywane w SQLite-backed Cloudflare Durable Object, a otwarte strony dostają zmiany przez WebSocket bez commitów i odświeżania. Odwiedzający nie mają kont ani dostępu do panelu.

## Struktura

- `index.html`, `admin.html` — strony GitHub Pages
- `src/css/` — style
- `src/js/app.js` — publiczny profil i połączenie na żywo
- `src/js/admin.js` — panel właściciela
- `src/js/api-config.js` — publiczny adres API Workera
- `worker/src/index.js`, `worker/wrangler.jsonc` — backend Cloudflare
- `LICENSE` — licencja MIT projektu JAQLIV, którego układ profilu i motywy zostały zaadaptowane

## Wdrożenie

1. Opublikuj pliki strony w głównym katalogu publicznego repozytorium GitHub. W **Settings → Pages** wybierz **Deploy from a branch**, `main`, `/ (root)`.
2. W Cloudflare utwórz aplikację Worker z katalogu `worker`. Konfiguracja `wrangler.jsonc` tworzy SQLite-backed Durable Object `ProfileStore` i binding `PROFILE`. Zainstaluj oficjalne narzędzie Wrangler (`npm install -g wrangler` lub `npx wrangler`), zaloguj się (`wrangler login`) i uruchom `wrangler deploy` z katalogu `worker`.
3. W Cloudflare Worker → **Settings → Variables and Secrets** dodaj sekret `ADMIN_PASSWORD` o długości co najmniej 16 znaków. Hasło ustaw samodzielnie; nie zapisuj go w GitHubie ani w plikach strony.
4. Skopiuj adres Workera `https://gunslol-profile-api.TWOJ_SUBDOMAIN.workers.dev` do `src/js/api-config.js` i opublikuj ten plik na GitHubie. W `worker/wrangler.jsonc` zmienna `ALLOWED_ORIGIN` powinna być równa origin GitHub Pages, w tym projekcie `https://toseine.github.io`.
5. Wejdź na `https://toseine.github.io/gunslol-profile/admin.html`, wpisz hasło i zapisz ustawienia. Profil publiczny jest pod `https://toseine.github.io/gunslol-profile/`.

## Ważne

- Panel nie tworzy kont dla odwiedzających. Hasło jest sprawdzane wyłącznie w Workerze; przeglądarka przechowuje tymczasowy token w `sessionStorage` przez maksymalnie 12 godzin.
- Użyj publicznych, bezpośrednich URL do plików `.mp4` i `.mp3`. Autostart dźwięku może być zablokowany przez przeglądarkę; wtedy pojawi się przycisk **Włącz muzykę**.
- Panel pozwala ustawić zdjęcie/GIF profilu, motyw startowy i osobne tło oraz muzykę dla pięciu motywów: podstawowego, hacker, deszcz, anime i samochód. Odwiedzający mogą chwilowo przełączyć motyw przyciskami 1–5. Puste pola mediów są dozwolone.
- Darmowy plan Workers i Durable Objects ma limity użycia. Przy przekroczeniu limitów API może przestać odpowiadać do ich odnowienia.

Układ profilu, pięć motywów i część stylów zaadaptowano z [JAQLIV/gunslol-open-source](https://github.com/JAQLIV/gunslol-open-source) na licencji MIT. Oryginalny kod właściciela JAQLIV nie zawiera hostowanych plików mediów; dodaj swoje URL w panelu. Integracja z Cloudflare i panel administracyjny zostały dopisane do tej wersji.
