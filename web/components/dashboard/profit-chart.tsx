"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { formatCurrency } from "@/lib/utils"

type Point = { month: string; profit: number }

export function ProfitChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(v) => formatCurrency(v, { compact: true })}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
              fontSize: 13,
            }}
            formatter={(value: number) => [formatCurrency(value), "Realized Profit"]}
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#profitFill)"
            dot={false}
            activeDot={{ r: 4, fill: "#10b981" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
