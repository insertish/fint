"use client";

import { dbBuildAccountTransactions } from "@/lib/dbFint";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export default function Home() {
  const [someData, setSomeData] = useState<any>();

  return (
    <div>
      <div className="flex justify-center">
        <div className="stats shadow grid">
          <ResponsiveContainer
            width="100%"
            height="100%"
            style={{ gridArea: "1/1" }}
          >
            <AreaChart
              width={100}
              height={100}
              data={[
                { name: "A", balance: 0 },
                { name: "B", balance: 100 },
                { name: "C", balance: 300 },
                { name: "D", balance: 400 },
                { name: "E", balance: 1400 },
              ]}
            >
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#8884d888"
                fill="#8884d822"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="stat" style={{ gridArea: "1/1" }}>
            <div className="stat-title">Balance</div>
            <div className="stat-value">£1,337</div>
            <div className="stat-desc">21% increase over last week</div>
          </div>
        </div>

        <div className="stats shadow grid">
          <ResponsiveContainer
            width="100%"
            height="100%"
            style={{ gridArea: "1/1" }}
          >
            <AreaChart
              width={100}
              height={100}
              data={[
                { name: "A", balance: 0 },
                { name: "B", balance: 100 },
                { name: "C", balance: 300 },
                { name: "D", balance: 400 },
                { name: "E", balance: 200 },
              ]}
            >
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#8884d888"
                fill="#8884d822"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="stat" style={{ gridArea: "1/1" }}>
            <div className="stat-title">Week&apos;s Spend</div>
            <div className="stat-value">£340</div>
            <div className="stat-desc">5% decrease over last week</div>
          </div>
        </div>

        <div className="stats shadow grid">
          <ResponsiveContainer
            width="100%"
            height="100%"
            style={{ gridArea: "1/1" }}
          >
            <AreaChart
              width={100}
              height={100}
              data={[
                { name: "A", balance: 4000 },
                { name: "B", balance: 200 },
                { name: "C", balance: 3000 },
                { name: "D", balance: 400 },
                { name: "E", balance: 1000 },
              ]}
            >
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#8884d888"
                fill="#8884d822"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="stat" style={{ gridArea: "1/1" }}>
            <div className="stat-title">Savings</div>
            <div className="stat-value">£132 mil</div>
          </div>
        </div>
      </div>

      <a
        className="btn btn-primary"
        onClick={() => dbBuildAccountTransactions().then(setSomeData)}
      >
        make!
      </a>

      {someData && (
        <div className="flex justify-center">
          <div className="stats grid w-[240px] h-[120px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              style={{ gridArea: "1/1" }}
            >
              <AreaChart width={100} height={100} data={someData[0]}>
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#8884d888"
                  fill="#8884d822"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="stat" style={{ gridArea: "1/1" }}>
              <div className="stat-title">Balance (30d)</div>
              <div className="stat-value">
                £{someData[0][someData[0].length - 1]["balance"].toFixed(2)}
              </div>
            </div>
          </div>
          <div className="stats grid w-[240px] h-[120px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              style={{ gridArea: "1/1" }}
            >
              <AreaChart width={100} height={100} data={someData[1]}>
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#8884d888"
                  fill="#8884d822"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="stat" style={{ gridArea: "1/1" }}>
              <div className="stat-title">Spending (30d)</div>
              <div className="stat-value">
                £
                {someData[1]
                  .reduce(
                    (p: number, n: { balance: number }) => p + n["balance"],
                    0
                  )
                  .toFixed(2)}
              </div>
            </div>
          </div>
          <div className="stats grid w-[240px] h-[120px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              style={{ gridArea: "1/1" }}
            >
              <AreaChart width={100} height={100} data={someData[2]}>
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#8884d888"
                  fill="#8884d822"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="stat" style={{ gridArea: "1/1" }}>
              <div className="stat-title">Income (30d)</div>
              <div className="stat-value">
                £
                {someData[2]
                  .reduce(
                    (p: number, n: { balance: number }) => p + n["balance"],
                    0
                  )
                  .toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
