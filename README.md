# Wizytówka + panel Firebase

Statyczna strona dla GitHub Pages. Ustawienia są zapisywane w Firebase Realtime Database i docierają do otwartych stron przez `onValue()` bez ponownego wdrażania.

## Uruchomienie

1. W [Firebase Console](https://console.firebase.google.com/) utwórz projekt. Analytics nie jest potrzebne. W **Ustawienia projektu → Twoje aplikacje** dodaj aplikację **WWW** (`</>`). Skopiuj obiekt `firebaseConfig`.
2. W **Build → Realtime Database** utwórz bazę (plan Spark). Skopiuj jej dokładny **databaseURL** z konsoli. Wybierz tryb zablokowany, bo reguły wkleisz w następnym kroku.
3. W **Build → Authentication → Sign-in method** włącz **Google**. W **Settings → Authorized domains** dodaj `TWOJ_LOGIN.github.io` (samą domenę, bez `https://` i ścieżki). Na stronie nie ma formularza rejestracji ani logowania e-mail/hasło.
4. Otwórz [src/js/firebase-config.js](src/js/firebase-config.js) i zastąp wartości konfiguracji danymi aplikacji WWW. `databaseURL` wklej dokładnie z Realtime Database. Na razie pozostaw `adminUid` jako `WKLEJ_UID_ADMINA`.
5. Wrzuć zawartość katalogu do głównego katalogu repozytorium GitHub. W **Settings → Pages → Build and deployment** wybierz **Deploy from a branch**, gałąź `main`, folder `/ (root)`. Otwórz `https://TWOJ_LOGIN.github.io/NAZWA_REPO/admin.html` i zaloguj się **własnym kontem Google**. Panel wyświetli UID zalogowanego konta.
6. Skopiuj UID do `adminUid` w [src/js/firebase-config.js](src/js/firebase-config.js) i zastąp nim `WKLEJ_UID_ADMINA` w [firebase.rules.json](firebase.rules.json). Całą zawartość reguł wklej w **Realtime Database → Rules** i kliknij **Publish**. Opublikuj zaktualizowany `firebase-config.js` na GitHubie. Od tej chwili panel otworzy się tylko dla tego UID, a baza pozwoli mu zapisywać ustawienia.

## Media

- Wpisz publiczne adresy HTTPS do bezpośrednich plików `.mp4` i `.mp3`. Pliki mogą leżeć także w repozytorium Pages, ale pola panelu przyjmują pełne URL, np. `https://TWOJ_LOGIN.github.io/NAZWA_REPO/media/tlo.mp4`.
- Jeśli media są na innym serwerze, musi on pozwalać na ich pobranie i odtwarzanie. Link do strony z odtwarzaczem nie jest linkiem do pliku.
- Przeglądarki często blokują automatyczny start dźwięku. Strona próbuje go uruchomić, a gdy przeglądarka odmówi, pokazuje przycisk **Włącz muzykę**.
- `admin.html` nie jest sekretnym adresem: prawdziwa ochrona zapisu jest w Firebase Auth i regułach bazy. Publiczna strona nie pokazuje opcji logowania ani tworzenia kont.
- Firebase Auth może technicznie utworzyć rekord użytkownika dla innej osoby, która sama otworzy adres `admin.html` i użyje przycisku Google. Taka osoba nadal nie otworzy edytora i nie zapisze nic w bazie, ponieważ jej UID nie pasuje do UID właściciela. Całkowite wyłączenie samodzielnego tworzenia rekordów Auth wymaga dodatkowej konfiguracji Identity Platform.

Źródło inspiracji wizualnej: [JAQLIV/gunslol-open-source](https://github.com/JAQLIV/gunslol-open-source). Kod projektu powstał od podstaw.
