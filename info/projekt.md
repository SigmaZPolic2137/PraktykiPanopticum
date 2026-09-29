# Zespół

1. **Łukasz Jabłoński** - lider, programista.
2. **Maksymilian Walczuk** - projektant, grafik, tester.
3. **Liam Jenees** - programista, tester.

# Plan projektu

### Cele na kolejne tygodnie

1. **Prototyp aplikacji** - przygotowanie podstawowej struktury komunikacji pomiędzy serwerem a klientem.
2. **Wersja beta** - działająca gra, testy oraz praca nad grafiką.
3. **Wersja finałowa** - ostateczne poprawki i przygotowanie aplikacji do publikacji.

# Wykorzystane technologie

Projekt wykorzystuje **JavaScript** w środowisku **Node.js** oraz bibliotekę **Socket.IO** do komunikacji w czasie rzeczywistym. Po stronie serwera wykorzystywany jest również **Express**, a **qrcode-esm** służy do generowania kodów QR.

## Dlaczego Socket.IO?

1. **Jeden język na frontendzie i backendzie** - wykorzystanie JavaScript upraszcza pracę nad obiema częściami aplikacji.
2. **Architektura sterowana zdarzeniami (Event-Driven)** - dobrze pasuje do komunikacji w czasie rzeczywistym.
3. **Gotowe mechanizmy komunikacji** - Socket.IO ułatwia obsługę połączeń, pokoi oraz ponownego łączenia.
4. **Możliwość dalszego skalowania** - biblioteka może współpracować m.in. z rozwiązaniami opartymi na Redis.

## Alternatywy i powody ich niewybrania

### 1. Python - WebSockets / Django Channels

Biblioteka WebSockets zapewnia podstawową komunikację, ale wymaga samodzielnego zaimplementowania większej części mechanizmów potrzebnych w projekcie. Django Channels oferuje więcej funkcji, jednak wymaga bardziej rozbudowanej konfiguracji.

### 2. Java / Spring Boot - WebFlux WebSocket

Spring Boot oferuje duże możliwości i dobre wsparcie dla większych projektów. W przypadku tego projektu jego konfiguracja oraz wykorzystanie Project Reactor mogłyby jednak wprowadzić niepotrzebną złożoność.

### 3. PHP - Swoole / Ratchet

Rozwiązania te umożliwiają komunikację w czasie rzeczywistym, jednak wymagają dodatkowej konfiguracji środowiska i zostały uznane za mniej wygodne w tym projekcie niż rozwiązanie oparte na Node.js i Socket.IO.

# Analiza ryzyka

| Ryzyko | Sposób ograniczenia |
| --- | --- |
| Problemy z komunikacją klient–serwer | Testowanie komunikacji już podczas tworzenia prototypu |
| Problemy z synchronizacją stanu gry | Przechowywanie głównego stanu gry po stronie serwera oraz walidacja danych |
| Utrata połączenia przez gracza | Obsługa ponownego połączenia i ponowna synchronizacja stanu gry |
| Problemy z wydajnością | Ograniczenie liczby komunikatów oraz testy obciążeniowe |
| Błędy wykryte pod koniec projektu | Regularne testowanie każdej wersji |
| Opóźnienia w przygotowaniu grafiki | Ustalenie podstawowego zakresu grafik potrzebnych do publikacji |
| Zbyt duży zakres projektu | Ustalenie funkcji wymaganych dla wersji beta i ograniczenie funkcji dodatkowych |
| Problemy podczas wdrożenia | Wykonanie próbnego wdrożenia przed wersją finałową |

## Najważniejsze ryzyka

Największym zagrożeniem jest **nieprawidłowa synchronizacja stanu gry pomiędzy użytkownikami**. Aby temu zapobiec, serwer powinien być głównym źródłem informacji o stanie gry, a dane otrzymywane od klientów powinny być walidowane.

Drugim istotnym ryzykiem jest **zbyt późne wykrycie błędów**. Testy powinny być wykonywane już od etapu prototypu, a nie dopiero przed publikacją.

Ze względu na krótki harmonogram ważne jest również **kontrolowanie zakresu projektu**. W pierwszej kolejności należy zrealizować funkcje niezbędne do działania gry, a dopiero później funkcje dodatkowe.

# Podsumowanie

Zastosowanie **Node.js, Express i Socket.IO** pozwala stosunkowo szybko stworzyć aplikację wykorzystującą komunikację w czasie rzeczywistym. Najważniejsze dla powodzenia projektu będzie wczesne przetestowanie komunikacji klient–serwer, prawidłowa synchronizacja stanu gry oraz utrzymanie zakresu projektu w ramach dostępnego czasu.
