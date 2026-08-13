import { FeatureDetail } from "../../culture/feature-detail";
export default function MotorDetail({params}:{params:Promise<{id:string}>}){return <FeatureDetail kind="motor" params={params}/>;}
