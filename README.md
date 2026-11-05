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
5. Wejdź na `https://toseine.github.io/gunslol-profile/admin.html`, wpisz hasło i zapisz ustawienia. Pierwszy profil publiczny jest pod `https://toseine.github.io/gunslol-profile/`. W panelu możesz tworzyć kolejne profile i przełączać się między nimi. Każdy nowy profil otrzymuje adres `https://toseine.github.io/gunslol-profile/index.html?profile=twoja-nazwa`.
6. Upload działa bez dodatkowego tokenu: pliki są zapisywane w Cloudflare Durable Object. Opcjonalnie, aby zapisywać je w repozytorium GitHub, utwórz fine-grained personal access token tylko dla `toseine/gunslol-profile` z uprawnieniem **Contents: Read and write** i dodaj jako sekret Workera `GITHUB_UPLOAD_TOKEN`. Nie umieszczaj tokenu w repozytorium ani na stronie.

## Ważne

- Panel nie tworzy kont dla odwiedzających. Hasło jest sprawdzane wyłącznie w Workerze; przeglądarka przechowuje tymczasowy token w `sessionStorage` przez maksymalnie 12 godzin.
- Jedno hasło właściciela zarządza maksymalnie 11 profilami (pierwszy i 10 dodatkowych). Każdy ma osobne ustawienia, presety, miesięczny licznik i aktualizacje na żywo. Wszystkie publiczne strony mogą być otwarte równocześnie. Usunięcie profilu z panelu usuwa jego ustawienia, presety i licznik; pierwszy profil nie może zostać usunięty.
- Użyj publicznych, bezpośrednich URL do plików `.mp4` i `.mp3`. Autostart dźwięku może być zablokowany przez przeglądarkę; wtedy pojawi się przycisk **Włącz muzykę**.
- Panel pozwala ustawić zdjęcie/GIF profilu i wybrać jeden aktywny styl z pięciu wariantów. Można zapisać do 20 nazwanych presetów obejmujących cały profil i aktywować dowolny bez ponownego ustawiania pól.
- Panel ma upload obrazów/GIF, MP4 i MP3 do Cloudflare Durable Object (maksymalnie 5 MB dla avatara i 15 MB dla innych plików). Plik jest dostępny od razu pod adresem Workera. Gdy jest ustawiony `GITHUB_UPLOAD_TOKEN`, upload używa katalogu `media/` na GitHubie. W zakładce Media & music można wybrać początek i koniec muzyki w sekundach oraz odsłuchać fragment. Przycięcie dotyczy odtwarzania na profilu; oryginalny plik pozostaje bez zmian. Można też ustawić fragment filmu, kadr tła, animacje, kursor i położenie elementów osobno dla komputera i telefonu.
- Suwaki w zakładce Appearance zmieniają szerokość profilu, rozmiar avatara, nazwy, opisu i przycisków społecznościowych. Podgląd pokazuje te zmiany przed zapisem. Na telefonie rozmiary są ograniczone do szerokości ekranu.
- W Appearance dostępne są szybkie palety kolorów, cztery style karty, kolor i grubość obramowania, odstępy, poświata oraz rozmiar odznak i odstępy ikon. W Media & music możesz ustawić jasność i rozmycie tła oraz wybrać śnieg, deszcz lub gwiazdy. Publiczny przycisk Share można wyłączyć w panelu. Te wartości są osobne dla każdego profilu i zapisują się również w presetach.
- Discord przyjmuje nazwę użytkownika; przycisk na profilu kopiuje ją do schowka. Nie wymaga kont odwiedzających.
- Darmowy plan Workers i Durable Objects ma limity użycia. Przy przekroczeniu limitów API może przestać odpowiadać do ich odnowienia.

Układ profilu, pięć motywów i część stylów zaadaptowano z [JAQLIV/gunslol-open-source](https://github.com/JAQLIV/gunslol-open-source) na licencji MIT. Oryginalny kod właściciela JAQLIV nie zawiera hostowanych plików mediów; dodaj swoje URL w panelu. Integracja z Cloudflare i panel administracyjny zostały dopisane do tej wersji.
