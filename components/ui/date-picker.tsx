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
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal bg-white",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày...</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          locale={vi}
        />
      </PopoverContent>
    </Popover>
  )
}

