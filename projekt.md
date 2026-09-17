# Zespół:
1. Łukasz Jabłoński: Lider, Programista;
2. Maksymilian Walczuk: Projektant, Grafik, Tester;
3. Liam Jenees: Programista, Tester.

# Plan projektu

**Cyfra za każdy tydzień:**

1. **Prototyp aplikacji** – przygotowanie struktury komunikacji pomiędzy serwerem a klientem.
2. **Wersja beta** – działająca gra, testy oraz praca nad grafiką.
3. **Wersja finałowa** – ostateczne poprawki i przygotowanie aplikacji do publikacji.

## Wykorzystane technologie

Projekt wykorzystuje bibliotekę **Socket.IO** w języku **JavaScript**, działającą w środowisku **Node.js**.

### Dlaczego Socket.IO?

1. **Jeden język** na frontendzie i backendzie – Full-stack JavaScript.
2. **Architektura sterowana zdarzeniami (Event-Driven)**, dobrze dopasowana do komunikacji w czasie rzeczywistym.
3. **Możliwość skalowania** dzięki mechanizmom takim jak Broadcasting oraz integracja z Redis.

### Alternatywy i dlaczego nie zostały wybrane

**1. Python – WebSockets / Django Channels**

Biblioteka WebSockets zapewnia podstawową komunikację, ale nie oferuje tylu gotowych mechanizmów, takich jak pokoje czy automatyczne ponowne połączenia. Django Channels zapewnia więcej funkcji, ale wymaga bardziej rozbudowanej konfiguracji.

**2. Java / Spring Boot – WebFlux WebSocket**

Spring Boot oferuje duże możliwości i wsparcie dla dużych projektów, jednak jego konfiguracja oraz wykorzystanie Project Reactor mogą być niepotrzebnie skomplikowane dla małego lub średniego projektu.

**3. PHP – Swoole / Ratchet**

Rozwiązania te umożliwiają komunikację w czasie rzeczywistym, jednak wymagają dodatkowej konfiguracji środowiska i są mniej wygodne w tym projekcie niż rozwiązanie oparte na Node.js i Socket.IO.

# Analiza ryzyka

| Ryzyko                               | Prawdopodobieństwo | Wpływ  | Sposób ograniczenia                                                             |
| ------------------------------------ | ------------------ | ------ | ------------------------------------------------------------------------------- |
| Problemy z komunikacją klient–serwer | Średnie            | Wysoki | Testowanie komunikacji już podczas tworzenia prototypu                          |
| Problemy z synchronizacją stanu gry  | Wysokie            | Wysoki | Przechowywanie głównego stanu gry po stronie serwera i walidacja danych         |
| Utrata połączenia przez gracza       | Średnie            | Wysoki | Obsługa reconnectów i ponowna synchronizacja stanu gry                          |
| Problemy z wydajnością               | Średnie            | Wysoki | Ograniczenie liczby komunikatów i testy obciążeniowe                            |
| Błędy wykryte pod koniec projektu    | Wysokie            | Wysoki | Regularne testowanie każdej wersji                                              |
| Opóźnienia w przygotowaniu grafiki   | Średnie            | Średni | Ustalenie podstawowego zakresu grafik potrzebnych do publikacji                 |
| Zbyt duży zakres projektu            | Wysokie            | Wysoki | Ustalenie funkcji wymaganych dla wersji beta i ograniczenie funkcji dodatkowych |
| Problemy podczas wdrożenia           | Średnie            | Wysoki | Wykonanie próbnego wdrożenia przed wersją finałową                              |

### Najważniejsze ryzyka

Największym zagrożeniem jest **nieprawidłowa synchronizacja stanu gry pomiędzy użytkownikami**. Aby temu zapobiec, serwer powinien być głównym źródłem informacji o stanie gry, a dane otrzymywane od klientów powinny być walidowane.

Drugim istotnym ryzykiem jest **zbyt późne wykrycie błędów**. Testy powinny być wykonywane już od etapu prototypu, a nie dopiero przed publikacją.

Ze względu na krótki harmonogram ważne jest również **kontrolowanie zakresu projektu**. W pierwszej kolejności należy zrealizować funkcje niezbędne do działania gry, a dopiero później funkcje dodatkowe.

## Podsumowanie

Zastosowanie Node.js i Socket.IO pozwala stosunkowo szybko stworzyć aplikację wykorzystującą komunikację w czasie rzeczywistym. Najważniejsze dla powodzenia projektu będzie wczesne przetestowanie komunikacji klient–serwer, prawidłowa synchronizacja stanu gry oraz utrzymanie zakresu projektu w ramach dostępnego czasu.
