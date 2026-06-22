import * as React from "react"
import { format, parse } from "date-fns"
import { vi } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/src/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePicker({
  value,
  onChange,
  className,
}: {
  value?: string | null
  onChange: (value: string) => void
  className?: string
}) {
  const date = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

  const handleSelect = (d?: Date) => {
    if (d) {
      onChange(format(d, 'yyyy-MM-dd'));
    } else {
      onChange('');
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center w-full justify-start text-left font-normal bg-white border border-input h-10 px-4 py-2 rounded-md text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground",
          !date && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        {date ? format(date, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày...</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={vi}
        />
      </PopoverContent>
    </Popover>
  )
}

