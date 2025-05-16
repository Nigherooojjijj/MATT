/**
 * RFID RC522 Erweiterung für den Calliope Mini V3
 * 
 * Verdrahtung:
 *   VCC  → VCC
 *   GND  → GND
 *   RST  → C4
 *   MISO → C15
 *   MOSI → C14
 *   SCK  → C13
 *   NSS  → P3
 */

namespace RFID {
    // Pin-Zuweisung entsprechend Calliope Mini V3
    const NSS: DigitalPin = DigitalPin.P3;
    const RST: DigitalPin = DigitalPin.C4;
    const MOSI: DigitalPin = DigitalPin.C14;
    const MISO: DigitalPin = DigitalPin.C15;
    const SCK: DigitalPin = DigitalPin.C13;

    // Register-Adressen laut MFRC522-Datenblatt
    const CommandReg     = 0x01;
    const ComIEnReg      = 0x02;
    const ComIrqReg      = 0x04;
    const FIFODataReg    = 0x09;
    const FIFOLevelReg   = 0x0A;
    const ControlReg     = 0x0C;
    const BitFramingReg  = 0x0D;
    const ModeReg        = 0x11;
    const TxControlReg   = 0x14;

    // Befehle an den MFRC522
    const PCD_IDLE       = 0x00;
    const PCD_SOFTRESET  = 0x0F;
    const PCD_TRANSCEIVE = 0x0C;

    // Befehle für RFID-Karten (PICC)
    const PICC_REQIDL    = 0x26;
    const PICC_ANTICOLL  = 0x93;

    // --- Low-Level SPI-Zugriffsfunktionen ---

    /**
     * Schreibt einen Byte-Wert in ein Register.
     */
    function writeReg(addr: number, val: number): void {
        pins.digitalWritePin(NSS, 0);
        let address: number = ((addr << 1) & 0x7E);
        pins.spiWrite(address);
        pins.spiWrite(val);
        pins.digitalWritePin(NSS, 1);
    }

    /**
     * Liest einen Byte-Wert aus einem Register.
     */
    function readReg(addr: number): number {
        pins.digitalWritePin(NSS, 0);
        let address: number = (((addr << 1) & 0x7E) | 0x80);
        pins.spiWrite(address);
        let val = pins.spiRead(0);
        pins.digitalWritePin(NSS, 1);
        return val;
    }

    /**
     * Setzt Bits in einem Register mittels Bitmasken-OR.
     */
    function setBitMask(addr: number, mask: number): void {
        let current = readReg(addr);
        writeReg(addr, current | mask);
    }

    /**
     * Löscht bestimmte Bits in einem Register.
     */
    function clearBitMask(addr: number, mask: number): void {
        let current = readReg(addr);
        writeReg(addr, current & (~mask));
    }

    // --- Funktionen für Initialisierung und Kommunikation ---

    /**
     * Führt einen Soft-Reset des MFRC522 durch.
     */
    export function reset(): void {
        writeReg(CommandReg, PCD_SOFTRESET);
        basic.pause(50);
        // Warte, bis der Reset abgeschlossen ist
        while ((readReg(CommandReg) & (1 << 4)) !== 0) {
            basic.pause(1);
        }
    }

    /**
     * Initialisiert das RFID-Modul:
     * - Konfiguriert SPI
     * - Setzt Timer und Betriebsmodus
     * - Aktiviert die Antenne
     */
    export function init(): void {
        // Konfiguriere SPI (MOSI, MISO, SCK)
        pins.spiPins(MOSI, MISO, SCK);
        // SPI-Frequenz auf 1 MHz setzen (kann ggf. angepasst werden)
        pins.spiFrequency(1000000);
        // Chip Select (NSS) zunächst HIGH
        pins.digitalWritePin(NSS, 1);
        // RST-Pin HIGH (Modul ist nicht im Reset)
        pins.digitalWritePin(RST, 1);

        reset();

        // Optionale Timer-Konfiguration (laut MFRC522-Datenblatt)
        writeReg(0x2A, 0x80);  // TimerModeReg
        writeReg(0x2B, 0xA9);  // TimerPrescalerReg
        writeReg(0x2C, 0x03);  // TimerReloadReg Low Byte
        writeReg(0x2D, 0xE8);  // TimerReloadReg High Byte

        // Betriebsmodus z. B. für CRC-Berechnung
        writeReg(ModeReg, 0x3D);

        antennaOn();
    }

    /**
     * Aktiviert die Antenne, sofern sie nicht bereits aktiv ist.
     */
    function antennaOn(): void {
        let value = readReg(TxControlReg);
        if ((value & 0x03) != 0x03) {
            setBitMask(TxControlReg, 0x03);
        }
    }

    /**
     * Sendet einen REQA-Befehl, um die Anwesenheit einer Karte zu prüfen.
     * @param reqMode Normalerweise PICC_REQIDL (0x26)
     * @returns 1, wenn eine Karte erkannt wird, sonst 0.
     */
    function request(reqMode: number): number {
        writeReg(BitFramingReg, 0x07);
        writeReg(FIFOLevelReg, 0x80);
        pins.digitalWritePin(NSS, 0);
        let addr = ((FIFODataReg << 1) & 0x7E);
        pins.spiWrite(addr);
        pins.spiWrite(reqMode);
        pins.digitalWritePin(NSS, 1);
        writeReg(CommandReg, PCD_TRANSCEIVE);
        setBitMask(BitFramingReg, 0x80);
        basic.pause(10);
        clearBitMask(BitFramingReg, 0x80);
        let i = 25;
        let irq = 0;
        do {
            basic.pause(1);
            irq = readReg(ComIrqReg);
            i--;
        } while (i > 0 && ((irq & 0x30) === 0));
        let length = readReg(FIFOLevelReg);
        if (length == 2) {
            return 1;
        }
        return 0;
    }

    /**
     * Führt den Antikollisions-Befehl aus, um die UID der Karte auszulesen.
     * @returns UID als Hex-String (z. B. "04AABBCCDD") oder einen leeren String, wenn keine Karte erkannt wird.
     */
    export function anticoll(): string {
        writeReg(FIFOLevelReg, 0x80);
        pins.digitalWritePin(NSS, 0);
        let addr = ((FIFODataReg << 1) & 0x7E);
        pins.spiWrite(addr);
        pins.spiWrite(PICC_ANTICOLL);
        pins.spiWrite(0x20);
        pins.digitalWritePin(NSS, 1);
        writeReg(CommandReg, PCD_TRANSCEIVE);
        setBitMask(BitFramingReg, 0x80);
        basic.pause(10);
        clearBitMask(BitFramingReg, 0x80);
        let fifoLevel = readReg(FIFOLevelReg);
        if (fifoLevel != 5) {
            return "";
        }
        let uid: number[] = [];
        for (let i = 0; i < fifoLevel; i++) {
            uid.push(readReg(FIFODataReg));
        }
        let uidStr = "";
        for (let i = 0; i < uid.length; i++) {
            let hex = uid[i].toString(16);
            if (hex.length < 2) {
                hex = "0" + hex;
            }
            uidStr += hex.toUpperCase();
        }
        return uidStr;
    }

    /**
     * Prüft, ob eine Karte im Lesefeld ist und gibt deren UID zurück.
     * @returns UID als Hex-String oder einen leeren String, falls keine Karte erkannt wurde.
     */
    export function getCardUID(): string {
        let status = request(PICC_REQIDL);
        if (status === 1) {
            return anticoll();
        }
        return "";
    }
}

// ---------------------------------------------------------------------------------
// Beispielanwendung: Lese die Karten-UID und zeige sie auf dem Display an
// ---------------------------------------------------------------------------------

RFID.init();

basic.forever(function () {
    let uid = RFID.getCardUID();
    if (uid != "") {
        basic.showString(uid);
        basic.pause(2000);
        basic.clearScreen();
    }
});
