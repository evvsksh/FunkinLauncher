import { Mod } from "../types/mod";
import { ModCard } from "./ModCard";

interface Props {
    mods: Mod[];
    onDownload: (mod: Mod) => void;
}

export function ModGrid({ mods, onDownload }: Props) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {mods.map((mod) => (
                <ModCard key={mod._idRow} mod={mod} onDownload={onDownload} />
            ))}
        </div>
    );
}
