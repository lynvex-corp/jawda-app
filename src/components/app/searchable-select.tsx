import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/* ============================================================
 * Bloco 10, item 2: campos de busca que hoje são só dropdown de lista
 * fechada (responsável, processo, indicador, fornecedor, plano...) devem
 * aceitar digitação livre — buscar por código OU por texto, não só
 * escolher de uma lista.
 *
 * Generaliza o combobox que já existia e funcionava bem só para vincular
 * NC (Command/CommandInput dentro de um Popover, em
 * nao-conformidades/nova-wizard.tsx) — em vez de duplicar essa UI em cada
 * tela nova, esta é a versão reutilizável, drop-in no lugar de <Select>
 * para escolha única.
 *
 * Não ordena as opções — segue a seção 21.7 do Guia (toda lista suspensa
 * em ordem alfabética, salvo ordem semântica): quem chama já deve passar
 * `options` na ordem certa.
 * ============================================================ */

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  /** Texto usado para casar a busca — por padrão label + sublabel (cobre
   * "buscar por código OU por texto" quando o código vira o sublabel). */
  searchText?: string;
}

interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar por código ou nome…",
  emptyMessage = "Nenhum resultado.",
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background",
            "cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("line-clamp-1 text-left", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.searchText ?? `${o.label} ${o.sublabel ?? ""}`}
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{o.label}</span>
                      {o.sublabel && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {o.sublabel}
                        </span>
                      )}
                    </div>
                    {o.value === value && <Check className="h-4 w-4 shrink-0 text-brand" />}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
