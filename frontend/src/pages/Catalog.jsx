import { useState } from "react";
import Products from "@/pages/Products";
import Inventory from "@/pages/Inventory";
import Categories from "@/pages/Categories";
import { Package, Boxes, Tags } from "lucide-react";

const TABS = [
  { k: "produk", l: "Produk", i: Package, C: Products },
  { k: "stok", l: "Persediaan", i: Boxes, C: Inventory },
  { k: "kategori", l: "Kategori", i: Tags, C: Categories },
];

export default function Catalog() {
  const [t, setT] = useState("produk");
  const Active = TABS.find((x) => x.k === t).C;
  return (
    <div className="h-full flex flex-col" data-testid="catalog-page">
      <div className="flex gap-1 p-2 border-b bg-white overflow-x-auto no-scrollbar" data-testid="catalog-tabs">
        {TABS.map((x) => (
          <button key={x.k} data-testid={`catalog-tab-${x.k}`} onClick={() => setT(x.k)}
            className={`tap flex items-center gap-2 px-4 h-10 rounded-lg font-bold text-sm whitespace-nowrap ${t === x.k ? "bg-[#E63946] text-white" : "text-[#52525B] hover:bg-[#F4F5F7]"}`}>
            <x.i size={16} /> {x.l}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden"><Active /></div>
    </div>
  );
}
