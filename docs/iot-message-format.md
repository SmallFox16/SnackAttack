# IoT Message Format

Each vending machine has a sensor that periodically sends a JSON message with its current status. During development, these messages come from a simulated sensor in iot-sensor.mjs (startSimulatedSensor())

## Example

```json
{
  "messageId": "msg-1793729290745-12",
  "deviceId": "sensor-3",
  "machineId": "3",
  "timestamp": "2026-11-09T15:41:30.745Z",
  "machineStatus": "Available",
  "products": [
    { "name": "Coca-Cola", "availability": "Available" },
    { "name": "Sprite", "availability": "Unavailable" }
  ]
}
```

## Fields

| Field | Type | Description |
|---|---|---|
| `messageId` | string | Unique ID for the message |
| `deviceId` | string | ID of the sensor that sent it |
| `machineId` | string | Matches the `ID` column in `vending_machines.csv` |
| `timestamp` | string | When the reading was taken (ISO 8601, UTC) |
| `machineStatus` | `"Available"` \| `"Unavailable"` | Whether the machine is working |
| `products` | array | Each product's `name` and `availability` (`"Available"` \| `"Unavailable"`) |

Messages that don't match this format are rejected by `isValidIoTMessage()`.

## Where messages go

`receiveSensorMessage()` stores the latest message for each machine in `state.sensorMessages` (key: machine ID as a string).