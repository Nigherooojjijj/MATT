MakeCode Package for the Calliope Mini V3 - RFID Module (MFRC522)
Beschreibung

Diese Bibliothek stellt ein Microsoft MakeCode-Paket für das Joy-IT SBC-RFID-RC522 RFID-Modul bereit. Weitere Informationen zum Modul findest du hier:https://joy-it.net/de/products/SBC-RFID-RC522
Verbindung

Das RFID-Modul muss mit sechs Pins an den Calliope Mini V3 angeschlossen werden:
RFID-Modul	Calliope Mini V3
VCC	VCC
GND	GND
MISO	C15
MOSI	C14
SCK	C13
NSS	P3
Funktionen
Initialisiere RFID-Modul

Das RFID-Modul muss vor der Verwendung initialisiert werden. Alle notwendigen Befehle werden über SPI übertragen.
// Initialisiere RFID-Modul
MFRC522.Init();
Lese UID von der Karte

Diese Funktion liest die eindeutige ID der Karte aus und gibt sie zurück.
// Lese eindeutige UID
MFRC522.getID();
Lese Daten von der Karte

Gespeicherte Daten auf der RFID-Karte können mit dieser Funktion abgerufen werden.
// Lese Daten
MFRC522.read();
Schreibe Daten auf die Karte

Schreibt Daten (als Zeichenfolge) auf die RFID-Karte.
// Schreibe Daten
MFRC522.write("1234");
Antenne ausschalten

Nach der Verwendung kann die RFID-Antenne deaktiviert werden, um Energie zu sparen.
// Antenne ausschalten
MFRC522.AntennaOff();
Unterstützte Ziele

✅ MakeCode für Calliope Mini V3
Lizenz

Diese Bibliothek steht unter der MIT-Lizenz.

