import type { ReactNode } from "react";
import "../auction-access.css";
import "../auction-winner.css";
import "../listed-by.css";
import ListedBy from "./listed-by";
import RealtimeAuctionEvents from "./realtime-auction-events";

export default function VehicleLayout({children}:{children:ReactNode}){
  return <>{children}<RealtimeAuctionEvents/><ListedBy/></>;
}
