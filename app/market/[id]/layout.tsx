import type { ReactNode } from "react";
import "../auction-access.css";
import "../auction-winner.css";
import ListedBy from "./listed-by";

export default function VehicleLayout({children}:{children:ReactNode}){
  return <>{children}<ListedBy/></>;
}
