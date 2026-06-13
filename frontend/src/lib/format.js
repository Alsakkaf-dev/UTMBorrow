// Turn backend enum-ish strings into human labels.
// Handles snake_case ("Request_Received") AND camelCase ("RequestReceived")
// → "Request Received".
export function humanizeType(value = "") {
  return String(value)
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}
