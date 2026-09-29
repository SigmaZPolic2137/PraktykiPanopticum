# Panopticum

Panopticum to wieloosobowa gra działająca w przeglądarce. Serwer obsługuje pokoje oraz komunikację w czasie rzeczywistym pomiędzy ekranem hosta a urządzeniami graczy.

## Zawartość projektu

```text
.
├── src/
│   ├── server.js          # serwer aplikacji
│   └── public/            # frontend gry i ekran hosta
│       ├── index.html     # ekran dołączania gracza
│       ├── host.html      # ekran hosta
│       ├── controller.js  # obsługa kontrolera gracza
│       ├── host.js        # obsługa hosta i lobby
│       ├── game.js        # logika rozgrywki
│       └── style.css      # style interfejsu
│
└── info/
    ├── instrukcja.md      # instrukcja uruchomienia i korzystania z gry
    ├── projekt.md         # informacje o zespole, planie, technologiach i ryzykach
    ├── pytanie.md         # odpowiedź na pytanie ze spotkania
    ├── readme.md          # indeks materiałów dodatkowych
    └── video/             # materiały wideo ze spotkania
```

## Uruchomienie

### Wymagania

- **Node.js**
- przeglądarka internetowa
- urządzenia graczy podłączone do tej samej sieci Wi-Fi co komputer hosta, jeżeli gra jest uruchamiana lokalnie

### Start serwera

Przejdź do katalogu `src/` i uruchom:

```bash
node server.js
```

Po poprawnym uruchomieniu serwera powinien pojawić się komunikat:

```text
Server running on port 3000.
```

Następnie na komputerze hosta otwórz:

```text
http://localhost:3000/
```

Szczegółową instrukcję znajdziesz w [`info/instrukcja.md`](info/instrukcja.md).

## Jak rozpocząć grę

1. Otwórz stronę gry w przeglądarce.
2. Na ekranie hosta utwórz pokój i skonfiguruj jego ustawienia.
3. Na urządzeniach graczy otwórz adres udostępniony przez hosta.
4. Gracze dołączają do pokoju, podając nazwę oraz hasło, jeżeli jest wymagane.
5. Host zarządza lobby i rozpoczyna grę.
6. Urządzenia graczy służą jako kontrolery, a rozgrywka jest wyświetlana na ekranie hosta.

Pełny opis obsługi znajduje się w [`info/instrukcja.md`](info/instrukcja.md).

## Dokumentacja

- [`info/instrukcja.md`](info/instrukcja.md) - instrukcja uruchomienia serwera i korzystania z gry.
- [`info/projekt.md`](info/projekt.md) - skład zespołu, plan projektu, wykorzystane technologie, uzasadnienie wyboru technologii oraz analiza ryzyka.
- [`info/pytanie.md`](info/pytanie.md) - odpowiedź na pytanie dotyczące jednej z decyzji projektowych.
- [`info/video/`](info/video/) - materiały wideo zaprezentowane podczas spotkania.

## Technologie

Projekt wykorzystuje:

- **JavaScript** - frontend i backend,
- **Node.js** - środowisko uruchomieniowe serwera,
- **Express** - obsługa serwera HTTP i plików statycznych,
- **Socket.IO** - komunikacja w czasie rzeczywistym pomiędzy hostem a graczami,
- **qrcode-esm** - generowanie kodów QR używanych do dołączania do gry.

Więcej informacji o wyborze technologii i rozważanych alternatywach znajduje się w [`info/projekt.md`](info/projekt.md).

## Autorzy

Informacje o składzie zespołu i rolach poszczególnych osób znajdują się w [`info/projekt.md`](info/projekt.md).
