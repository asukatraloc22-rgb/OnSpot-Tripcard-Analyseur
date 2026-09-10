import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePayload(data: any): any {
  if (!data || !Array.isArray(data.services)) return data;

  const seen = new Set<string>();
  
  // Filtrage des doublons de services
  data.services = data.services.filter((service: any) => {
    const key = `${service.type}-${service.date}-${service.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Correction des incohérences de localisation sur les activités/transferts
  data.services.forEach((service: any) => {
    if (service.type === "transfer" || service.type === "activity") {
      if (service.title?.includes("Paris") && service.location?.includes("Munich")) {
        service.location = "Paris, France";
      }
    }
  });

  return data;
}