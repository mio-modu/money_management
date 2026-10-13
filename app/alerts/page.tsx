'use client'

import { useMemo, useState } from 'react'
import { AlertCard } from '@/components/alert-card'
import { Card, CardHead } from '@/components/ui/card'
import { Empty, Segmented } from '@/components/ui/bits'
import { balancedFeed } from '@/lib/agent/engine'
import { useStore } from '@/lib/store'

type Tab = 'open' | 'done' | 'all'

export default function AlertsPage() {
  const db = useStore((s) => s.db)
  const [tab, setTab] = useState<Tab>('open')

  const list = useMemo(() => {
    if (tab === 'done') return db.alerts.filter((a) => a.action_taken || a.dismissed_at)
    if (tab === 'all') return [...db.alerts].sort((a, b) => b.weight - a.weight)
    return balancedFeed(db.alerts.filter((a) => !a.action_taken), 20)
  }, [db.alerts, tab])

  const counts = {
    warn: db.alerts.filter((a) => (a.severity === 'warn' || a.severity === 'danger') && !a.action_taken).length,
    praise: db.alerts.filter((a) => a.severity === 'praise').length,
  }

  return (
    <div className="space-y-3 p-3">
      <Card>
        <CardHead
          title="에이전트 기록"
          sub={`규칙 15종이 매 입력마다, 그리고 매일 자정에 돌아간다. 지금 열린 경고 ${counts.warn}건 · 칭찬 ${counts.praise}건`}
        />
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: '열린 것' },
          { value: 'done', label: '처리함' },
          { value: 'all', label: '전체' },
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <Empty
            title={tab === 'open' ? '열린 경고가 없다' : '아직 기록이 없다'}
            body={
              tab === 'open'
                ? '지금 당장 손댈 것이 없다는 뜻이다. 이 상태를 유지하는 게 목표다.'
                : '지출을 넣으면 규칙이 돌기 시작하고, 그 결과가 여기 쌓인다.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-faint">
        같은 상황은 다시 쌓이지 않는다. 같은 경고가 매일 늘어나면 읽지 않게 되기 때문이다.
        상황이 해결되면 목록에서 조용히 사라진다.
      </p>
    </div>
  )
}
