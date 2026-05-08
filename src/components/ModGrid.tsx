import { Mod } from "../types/mod";
import { ModCard } from "./ModCard";

interface Props {
    mods: Mod[];
}

export function ModGrid({ mods }: Props) {
    return (
        <div className="grid grid-cols-3 gap-3.5">
            {mods.map((mod) => (
                <ModCard key={`${mod._idRow}`} mod={mod} />
            ))}
        </div>
    );
}
