/**
 * MFRC522 Erweiterung für den Calliope Mini V3
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

namespace MFRC522 {
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

    function writeReg(addr: number, val: number): void {
        pins.digitalWritePin(NSS, 0);
        // Adresse berechnen nach MFRC522-Spezifikation
        let address: number = ((addr << 1) & 0x7E);
        pins.spiWrite(address);
        pins.spiWrite(val);
        pins.digitalWritePin(NSS, 1);
    }

    function readReg(addr: number): number {
        pins.digitalWritePin(NSS, 0);
        // 0x80 bit hinzufügen für den Lesebefehl
        let address: number = (((addr << 1) & 0x7E) | 0x80);
        pins.spiWrite(address);
        let val = pins.spiRead(0);
        pins.digitalWritePin(NSS, 1);
        return val;
    }

    function setBitMask(addr: number, mask: number): void {
        let current = readReg(addr);
        writeReg(addr, current | mask);
    }

    function clearBitMask(addr: number, mask: number): void {
        let current = readReg(addr);
        writeReg(addr, current & (~mask));
    }

    function resetModule(): void {
        writeReg(CommandReg, PCD_SOFTRESET);
        basic.pause(50);
        while ((readReg(CommandReg) & (1 << 4)) !== 0) {
            basic.pause(1);
        }
    }

    function antennaOn(): void {
        let value = readReg(TxControlReg);
        if ((value & 0x03) != 0x03) {
            setBitMask(TxControlReg, 0x03);
        }
    }

    function requestCard(reqMode: number): number {
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

    function anticollision(): string {
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

    // =========================================================================
    // Blockdefinitionen – diese Funktionen erscheinen im Editor als Blöcke
    // =========================================================================

    /**
     * Initialize MFRC522 Module
     */
    //% block="Initialize MFRC522 Module"
    export function Init(): void {
        // Konfiguration der SPI-Schnittstelle (MOSI: C14, MISO: C15, SCK: C13)
        pins.spiPins(MOSI, MISO, SCK);
        pins.spiFrequency(1000000);
        // Chip Select (NSS) und Reset (RST) setzen
        pins.digitalWritePin(NSS, 1);
        pins.digitalWritePin(RST, 1);
        resetModule();
        // Beispielhafte Timer- und Modus-Konfiguration (laut Datenblatt)
        writeReg(0x2A, 0x80);
        writeReg(0x2B, 0xA9);
        writeReg(0x2C, 0x03);
        writeReg(0x2D, 0xE8);
        writeReg(ModeReg, 0x3D);
        antennaOn();
    }

    /**
     * Read ID
     * @returns the card's ID as a Hex string (e.g., "04AABBCCDD")
     */
    //% block="Read ID"
    export function getID(): string {
        let status = requestCard(PICC_REQIDL);
        if (status === 1) {
            return anticollision();
        }
        return "";
    }

    /**
     * Read data
     * @returns the data read from the RFID card as a string
     */
    //% block="Read data"
    export function read(): string {
        // Hier sollte die spezifische Lese-Implementierung erfolgen.
        return "ExampleData";
    }

    /**
     * Write Data %text
     * @param text the text to write to the RFID card
     */
    //% block="Write Data %text"
    export function write(text: string): void {
        // Hier die Implementierung des Schreibvorgangs einfügen.
        serial.writeLine("Writing data: " + text);
    }

    /**
     * Turn off antenna
     */
    //% block="Turn off antenna"
    export function AntennaOff(): void {
        // Hier die Implementierung zum Abschalten der Antenne.
        serial.writeLine("Antenna turned off.");
    }
}
