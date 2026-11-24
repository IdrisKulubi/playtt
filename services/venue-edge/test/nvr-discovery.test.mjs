import assert from "node:assert/strict"
import test from "node:test"

import { parseProbeMatch } from "../src/setup/nvr-discovery.ts"

test("parses an ONVIF ProbeMatch into address, name and model", () => {
  const xml = `<SOAP-ENV:Envelope><SOAP-ENV:Body><d:ProbeMatches><d:ProbeMatch>
    <d:Scopes>onvif://www.onvif.org/type/NetworkVideoTransmitter onvif://www.onvif.org/name/VIGI_NVR onvif://www.onvif.org/hardware/NVR1008H</d:Scopes>
    <d:XAddrs>http://192.168.0.240:80/onvif/device_service http://[fe80::1]/onvif/device_service</d:XAddrs>
  </d:ProbeMatch></d:ProbeMatches></SOAP-ENV:Body></SOAP-ENV:Envelope>`
  const parsed = parseProbeMatch(xml)
  assert.deepEqual(parsed, { host: "192.168.0.240", name: "VIGI NVR", model: "NVR1008H", recorder: true })
})

test("ignores replies without an IPv4 address", () => {
  assert.equal(parseProbeMatch("<d:XAddrs>http://[fe80::1]/onvif</d:XAddrs>"), null)
  assert.equal(parseProbeMatch("<nothing/>"), null)
})
