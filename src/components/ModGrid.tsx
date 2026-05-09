import { Mod } from "../types/mod";
import { ModCard } from "./ModCard";

interface Props {
    mods: Mod[];
}

export function ModGrid({ mods }: Props) {
    return (
        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {mods.map((mod) => (
                <ModCard key={mod._idRow} mod={mod} />
            ))}
        </div>
    );
}
