# Instrukcja uruchomienia gry

## 1. Wymagania

Upewnij się, że masz zainstalowane oprogramowanie **Node.js**. Jeżeli nie, pobierz je ze [strony Node.js](https://nodejs.org/en/download).

## 2. Uruchomienie serwera

Otwórz **wiersz poleceń** lub **PowerShell** w katalogu `src`, tak aby plik `server.js` znajdował się w bieżącym katalogu.

Następnie wpisz:

```bash
node server.js
```

Po chwili powinien wyświetlić się komunikat:

```text
Server running on port 3000.
```

## 3. Otwarcie gry

Na komputerze hosta otwórz w przeglądarce:

```text
http://localhost:3000/
```

Powinna wyświetlić się strona główna gry z ekranem **Dołącz do gry**.

Aby utworzyć pokój, przejdź do **Ekranu hosta**.

## 4. Utworzenie pokoju

Na ekranie hosta:

1. wpisz nazwę pokoju,
2. opcjonalnie ustaw hasło,
3. wybierz maksymalną liczbę graczy,
4. wybierz, czy gra ma automatycznie rozpocząć się po przygotowaniu wszystkich graczy,
5. kliknij **Utwórz pokój**.

Po utworzeniu pokoju pojawi się lobby oraz adresy, za pomocą których gracze mogą dołączyć.

## 5. Dołączanie graczy

Aby połączyć urządzenie gracza z pokojem:

1. upewnij się, że urządzenie jest w tej samej sieci Wi-Fi co komputer hosta, jeżeli gra działa lokalnie,
2. skopiuj jeden z adresów wyświetlonych przez hosta i otwórz go na urządzeniu gracza,
3. opcjonalnie włącz **Dodaj nazwę pokoju do linku**, aby nazwa pokoju została dodana do linku,
4. jeżeli pokój jest zabezpieczony hasłem, można również dodać hasło do linku,
5. zamiast kopiowania linku można zeskanować wyświetlony kod QR,
6. po otwarciu linku dane pokoju powinny zostać uzupełnione automatycznie,
7. wpisz nazwę gracza i kliknij **Dołącz**.

Jeżeli dostępnych jest kilka adresów i jeden z nich nie działa, spróbuj kolejnego.

## 6. Lobby i rozpoczęcie gry

W lobby host może:

- obserwować listę graczy,
- wybrać poziom trudności,
- wyrzucić gracza z pokoju,
- zamknąć pokój,
- rozpocząć grę.

Aby rozpocząć rozgrywkę, kliknij **Start**. Jeżeli włączony jest automatyczny start, gra może rozpocząć się po przygotowaniu wszystkich graczy.

## Problemy i pytania

Jeżeli coś nie działa lub masz pytania dotyczące projektu, skontaktuj się z zespołem projektu.
