/**
 * Parent Location — campus-level geo-tag for recent attendance records.
 * Privacy-first: shows only building/room name, never exact GPS coordinates.
 */
import { useState } from 'react';
import { MapPin, Clock, CheckCircle2, AlertTriangle, Shield, Info } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useParentDashboard, useChildToday } from '../../hooks/useParentDashboard';
import { ChildSelector } from '../../components/parent/ChildSelector';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/utils';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const STATUS_CFG = {
  present: { color: 'text-success', bg: 'bg-success/10', dot: 'bg-success', icon: CheckCircle2 },
  late:    { color: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning', icon: AlertTriangle },
  absent:  { color: 'text-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive', icon: AlertTriangle },
};

export default function ParentLocation() {
  const { user } = useAuthStore();
  const { data: parentData, isLoading: parentLoading } = useParentDashboard(user?.id);
  const children = parentData?.children ?? [];

  const [selectedChildId, setSelectedChildId] = useState('');
  const activeChildId = selectedChildId || children[0]?.id;
  const activeChild = children.find(c => c.id === activeChildId);

  const { data: todayData, isLoading: todayLoading } = useChildToday(user?.id, activeChildId);
  const recent = todayData?.recent ?? [];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <PageHeader title="Location" subtitle="Campus attendance locations for recent sessions" />

      {/* Privacy notice */}
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 p-4">
        <Shield className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-info">Privacy Notice</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            For your child's privacy, only the campus building or room name is shown — never exact GPS coordinates.
            Location data is captured only at the moment of attendance marking and is used solely to verify
            classroom presence.
          </p>
        </div>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <ChildSelector children={children} selectedId={activeChildId} onChange={setSelectedChildId} />
      )}

      {/* Campus map placeholder */}
      {activeChild && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="bg-muted/30 h-40 flex items-center justify-center relative">
            {/* Stylised campus map placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-3 opacity-20">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-8 w-16 rounded bg-foreground" />
                ))}
              </div>
            </div>
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg">
                <MapPin className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="rounded-lg bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow">
                Greenfield University Campus
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Campus map view — building-level locations only
          </div>
        </div>
      )}

      {/* Recent attendance locations */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Recent Attendance Locations
        </h2>

        {todayLoading || parentLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <MapPin className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No recent attendance records</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(r => {
              const cfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.present;
              const Icon = cfg.icon;
              return (
                <div key={r.id} className={cn('rounded-xl border p-4 flex items-start gap-3', cfg.bg, 'border-transparent')}>
                  {/* Status dot + icon */}
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0', cfg.bg)}>
                    <Icon className={cn('h-5 w-5', cfg.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{r.course_code}</p>
                        <p className="text-xs text-muted-foreground">{r.course_name}</p>
                      </div>
                      <span className={cn('text-xs font-bold capitalize flex-shrink-0', cfg.color)}>
                        {r.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmt(r.marked_at)}
                      </span>
                      {r.campus_location && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                          {r.campus_location}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{r.faculty_name}</span>
                      <span className="capitalize">{r.session_type}</span>
                      {r.is_manual_override && (
                        <span className="text-warning font-medium">Manual override</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Privacy footer */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Location data is only captured during attendance marking and is not tracked continuously.
          Only campus building information is visible to parents.
        </span>
      </div>
    </div>
  );
}
