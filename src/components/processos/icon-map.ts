import {
  Boxes,
  Building2,
  ClipboardCheck,
  Cog,
  Factory,
  HardHat,
  Handshake,
  Landmark,
  Megaphone,
  Package,
  Scale,
  Server,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ProcessMapIcon } from "@/lib/queries/processos";

/** Import nomeado por ícone — `import * as Icons from "lucide-react"`
 * puxava a biblioteca inteira pro bundle (1,1 MB não-gzipado, ~174 KB
 * gzip) porque impede tree-shaking. Só estes 17 (o mesmo conjunto do
 * CHECK de `process_maps.icon`) entram no bundle assim. */
export const PROCESS_MAP_ICONS: Record<ProcessMapIcon, LucideIcon> = {
  Boxes,
  Building2,
  ClipboardCheck,
  Cog,
  Factory,
  HardHat,
  Handshake,
  Landmark,
  Megaphone,
  Package,
  Scale,
  Server,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
};
