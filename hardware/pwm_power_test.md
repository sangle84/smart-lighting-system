# LIGHT-001 PWM Power Test

## Evidence status

This record captures the hardware validation summary supplied for node `LIGHT-001`. The raw serial log is not stored in this repository yet, so the numeric results below are recorded as reported results, not independently re-run evidence by the coding agent.

## Test scope

- ESP32 powered by USB.
- 12 V adapter used for the LED power path.
- IRLZ44N low-side MOSFET driven by GPIO18.
- INA219 on I2C address `0x40`.
- INA219 connected in the power path: adapter 12 V -> INA219 `Vin+` -> `Vin-` -> LED positive.
- PWM test used 8-bit duty at 5 kHz.

## Reported results

| Measurement | Reported observation |
|---|---|
| INA219 initialization | Successful at `0x40` |
| Bus voltage | Approximately `12.24 V` down to `11.79 V` as load increased |
| Current | Approximately `35.8 mA` at `9.4%` PWM, increasing above `334 mA` at `100%` PWM |
| Power | Approximately `4 W` maximum at `100%` PWM |
| LED/MOSFET behavior | Reported stable across the PWM ramp |

The reported voltage drop is consistent with voltage drop in the adapter and wiring under load, but the exact cause should be confirmed with a raw log and a separate multimeter measurement if this becomes a production-quality measurement.

## Safety and scope notes

- Keep the 12 V supply isolated from the ESP32 3.3 V rail.
- Keep a common ground between the ESP32 and the MOSFET source as specified by the pinout.
- Do not change the wiring or raise the supply voltage based only on this summary.
- This record does not by itself prove the full Firmware MVP or MQTT integration.

## Next validation evidence

Attach the unabridged serial monitor output and the test date/time here when available. The next software validation must also confirm the MQTT topic and payload contract before firmware telemetry and command handling are implemented.
