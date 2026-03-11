"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Variable, Search } from "lucide-react";

interface VariablePickerProps {
  variables: string[];
  onInsert: (variable: string) => void;
}

// Group variables by category
const VARIABLE_CATEGORIES: Record<string, { label: string; description: string }> = {
  client: {
    label: "Client",
    description: "Client information",
  },
  session: {
    label: "Session",
    description: "Session details",
  },
  program: {
    label: "Program",
    description: "Program information",
  },
  attendance: {
    label: "Attendance",
    description: "Attendance record",
  },
  custom: {
    label: "Custom",
    description: "Custom variables",
  },
};

// Variable descriptions
const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  "client.firstName": "Client's first name",
  "client.lastName": "Client's last name",
  "client.fullName": "Client's full name",
  "session.title": "Session title",
  "session.date": "Session date",
  "session.topic": "Session topic",
  "session.duration": "Session duration",
  "program.name": "Program name",
  "program.facilitator": "Program facilitator name",
  "attendance.type": "Attendance type (Present, Absent, Excused)",
  "attendance.timeIn": "Time in",
  "attendance.timeOut": "Time out",
  "attendance.hoursAttended": "Hours attended",
};

export function VariablePicker({ variables, onInsert }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Group variables by category
  const groupedVariables = variables.reduce((acc, variable) => {
    const [category] = variable.split(".");
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(variable);
    return acc;
  }, {} as Record<string, string[]>);

  // Filter variables by search
  const filteredGroups = Object.entries(groupedVariables).reduce(
    (acc, [category, vars]) => {
      const filtered = vars.filter(
        (v) =>
          v.toLowerCase().includes(search.toLowerCase()) ||
          VARIABLE_DESCRIPTIONS[v]?.toLowerCase().includes(search.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  const handleInsert = (variable: string) => {
    onInsert(variable);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Variable className="mr-2 h-4 w-4" />
          Insert Variable
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search variables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <ScrollArea className="h-72">
          <div className="p-2">
            {Object.entries(filteredGroups).map(([category, vars]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {VARIABLE_CATEGORIES[category]?.label || category}
                </div>
                <div className="space-y-1">
                  {vars.map((variable) => (
                    <button
                      key={variable}
                      className="w-full text-left px-2 py-2 hover:bg-muted rounded-md transition-colors"
                      onClick={() => handleInsert(variable)}
                    >
                      <div className="font-mono text-sm text-primary">
                        {`{{${variable}}}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {VARIABLE_DESCRIPTIONS[variable] || variable}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(filteredGroups).length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                No variables found
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
