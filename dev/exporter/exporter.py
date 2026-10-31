"""Fake inventory and monitoring exporter for the dev stack.

Serves Prometheus metrics for the devices of tests/fixtures/multi-rack, as a NetBox exporter and a monitoring
system would:

- netbox_rack_info{rack,name,u_height,starting_unit,desc_units,site} 1
- netbox_device_info{device,rack,position,u_height,face,is_full_depth,role,model} 1
- device_up{device} 1 or 0, for monitored devices only; a device goes down now and then
- device_temperature_celsius{device}, a random walk with a spike now and then (fires HighTemperature)

Standard library only.
"""

import csv
import random
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FIXTURES = "/fixtures/multi-rack"
PORT = 9106


def read(name):
    with open(f"{FIXTURES}/{name}.csv", newline="") as f:
        return list(csv.DictReader(f))


RACKS = read("racks")
DEVICES = read("devices")
MONITORED = [d for d in DEVICES if d["status"] != ""]
temperature = {d["device"]: float(d["value"] or 30) for d in MONITORED if d["role"] != "pdu"}
down_until = {d["device"]: float("inf") for d in MONITORED if d["status"] == "0"}
spike_until = {}


def labels(**kv):
    escaped = (str(v).replace("\\", "\\\\").replace('"', '\\"') for v in kv.values())
    return "{" + ",".join(f'{k}="{v}"' for k, v in zip(kv, escaped)) + "}"


def tick(now):
    for name, value in temperature.items():
        base = next(float(d["value"] or 30) for d in MONITORED if d["device"] == name)
        # Mean-reverting random walk around the fixture value.
        temperature[name] = round(value + random.uniform(-0.8, 0.8) + (base - value) * 0.1, 1)
    if random.random() < 0.05:
        spike_until[random.choice(list(temperature))] = now + 90
    if random.random() < 0.03:
        down_until[random.choice(MONITORED)["device"]] = now + 60


def metrics():
    now = time.time()
    tick(now)
    lines = ["# TYPE netbox_rack_info gauge"]
    for r in RACKS:
        lines.append(f"netbox_rack_info{labels(**r)} 1")
    lines.append("# TYPE netbox_device_info gauge")
    for d in DEVICES:
        info = {k: d[k] for k in ("device", "rack", "position", "u_height", "face", "is_full_depth", "role", "model")}
        lines.append(f"netbox_device_info{labels(**info)} 1")
    lines.append("# TYPE device_up gauge")
    for d in MONITORED:
        up = 0 if down_until.get(d["device"], 0) > now else 1
        lines.append(f'device_up{labels(device=d["device"])} {up}')
    lines.append("# TYPE device_temperature_celsius gauge")
    for name, value in temperature.items():
        spike = 25 if spike_until.get(name, 0) > now else 0
        lines.append(f"device_temperature_celsius{labels(device=name)} {value + spike}")
    return "\n".join(lines) + "\n"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_error(404)
            return
        body = metrics().encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"exporter on :{PORT}, {len(DEVICES)} devices in {len(RACKS)} racks")
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
