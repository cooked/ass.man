import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Building2, Boxes, MapPin, Mail, Phone } from "lucide-react";
import { CustomerAsset, KitAsset, SensorAsset } from "../types/schema";

interface CustomersMapViewProps {
  customers: any[];
  kits?: any[];
  sensors?: any[];
}

export const CustomersMapView: React.FC<CustomersMapViewProps> = ({
  customers,
  kits,
  sensors
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAsset | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on Emilia-Romagna / North Italy
    const map = L.map(mapContainerRef.current).setView([44.5000, 10.8500], 8);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
    });

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    customers.forEach((customer) => {
      const lat = customer.latitude ?? customer.lat;
      const lng = customer.longitude ?? customer.lng;
      if (lat === undefined || lng === undefined) return;

      const customerKits = kits.filter(k => k.customer_id === customer.code);
      const customerSensors = sensors.filter(s =>
        s.customer_id === customer.code || (s.kit_id && customerKits.some(k => k.kit_code === s.kit_id))
      );

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="
            background: linear-gradient(135deg, #e11d48, #be123c);
            color: white;
            padding: 3px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 2px 6px rgba(190, 18, 60, 0.4);
            border: 2px solid #ffffff;
            cursor: pointer;
            white-space: nowrap;
          ">
            <span>🏭</span>
            <span>${customer.company_name.split(" ")[0]}</span>
            <span style="background: rgba(0,0,0,0.25); border-radius: 9999px; padding: 1px 5px; font-size: 10px;">${customerSensors.length}</span>
          </div>
        `,
        iconSize: [120, 26],
        iconAnchor: [60, 13]
      });

      const marker = L.marker([customer.lat, customer.lng], { icon: customIcon });

      marker.on("click", () => {
        setSelectedCustomer(customer);
        map.flyTo([customer.lat, customer.lng], 11, { duration: 1 });
      });

      layer.addLayer(marker);
    });
  }, [customers, kits, sensors]);

  const selectedKits = selectedCustomer
    ? kits.filter(k => k.customer_id === selectedCustomer.code)
    : [];

  const selectedSensors = selectedCustomer
    ? sensors.filter(s =>
        s.customer_id === selectedCustomer.code ||
        (s.kit_id && selectedKits.some(k => k.kit_code === s.kit_id))
      )
    : [];

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-full overflow-hidden">
      {/* Map Canvas */}
      <div className="flex-1 bg-white border border-slate-300 rounded shadow-xs overflow-hidden relative">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        <div className="absolute top-2 left-2 z-10 bg-white/95 backdrop-blur-xs border border-slate-300 px-2.5 py-1.5 rounded shadow-xs text-xs whitespace-nowrap">
          <div className="flex items-center space-x-1.5 font-bold text-slate-800">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>Bonfiglioli Customer Facilities Map</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Click a facility marker to inspect active IoT kits and sensors.</p>
        </div>
      </div>

      {/* Detail Sidebar */}
      <div className="w-full lg:w-80 bg-white border border-slate-300 rounded shadow-xs p-3 flex flex-col overflow-hidden shrink-0">
        {selectedCustomer ? (
          <div className="flex flex-col h-full space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                  {selectedCustomer.code}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{selectedCustomer.city}</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 mt-1 truncate">{selectedCustomer.company_name}</h3>
              <p className="text-[10.5px] text-slate-500 truncate">{selectedCustomer.plant_name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{selectedCustomer.address}</p>
            </div>

            {selectedCustomer.contact_person && (
              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[10.5px] space-y-0.5">
                <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">Technical Contact:</div>
                <div className="text-slate-800 font-medium truncate">{selectedCustomer.contact_person}</div>
                {selectedCustomer.contact_email && (
                  <div className="text-rose-600 flex items-center space-x-1 text-[10px] truncate">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{selectedCustomer.contact_email}</span>
                  </div>
                )}
              </div>
            )}

            {/* KPI Badges */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Installed Kits</div>
                <div className="text-base font-bold text-rose-600 font-mono">{selectedKits.length}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Active Sensors</div>
                <div className="text-base font-bold text-emerald-600 font-mono">{selectedSensors.length}</div>
              </div>
            </div>

            {/* Installed Kits List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Installed Kits at this Site:
              </div>
              {selectedKits.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-2">No kits deployed at this facility.</p>
              ) : (
                selectedKits.map(k => (
                  <div key={k.kit_code} className="bg-slate-50 p-2 rounded border border-slate-200 text-xs whitespace-nowrap">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-700 text-[11px]">{k.kit_code}</span>
                      <span className="text-[9.5px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">{k.status}</span>
                    </div>
                    <div className="text-slate-800 font-medium text-[11px] mt-0.5 truncate">{k.kit_name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{k.target_machine}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-1.5 p-4">
            <Building2 className="w-6 h-6 text-slate-300" />
            <p className="text-xs text-slate-500">Select an industrial facility marker on the map to inspect installed kits and sensor telemetry.</p>
          </div>
        )}
      </div>
    </div>
  );
};
