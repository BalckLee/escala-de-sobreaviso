import React, { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    Users,
    Settings,
    Download,
    Zap,
    Clock,
    ArrowRightLeft,
    Sun,
    Moon
} from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isWeekend,
    addMonths,
    subMonths,
    isToday,
    getDay,
    addDays,
    subDays,
    startOfWeek,
    endOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import Holidays from 'date-holidays';

const hd = new Holidays('BR', 'SP');


const LEGENDS = {
    'S': 'Sobreaviso das 17hs48m até 08hs',
    'S1': 'Sobreaviso das 00hs até às 08hs',
    'S2': 'Sobreaviso das 17hs48m até às 00hs',
    'S3': 'Sobreaviso das 00hs até 08hs e das 17hs48m até 08hs',
    'SS': 'Sobreaviso 24hs',
    'F': 'FÉRIAS'
};


const INITIAL_EMPLOYEES = [
    { id: 1, name: 'RENATO MARTINS', phone: '(11) 93393-4722' },
    { id: 2, name: 'WALTER ALBERTO', phone: '(11) 95072-0498' },
    { id: 3, name: 'GUILHERME ALBERTO', phone: '(11) 93256-6628' }
];

function App() {
    const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // Março 2026
    const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
    const [scale, setScale] = useState({});
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedDay, setSelectedDay] = useState(null);
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Geração Automática de Escala (7 dias seguidos + Transição na Segunda)
    const generateScale = () => {
        // Agora a escala sempre começa no domingo e termina no sábado
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });

        const days = eachDayOfInterval({ start, end });

        const newScale = {};

        days.forEach((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = getDay(day); // 0 = Dom, 1 = Seg...

            const baseDate = new Date(2026, 0, 1);
            const diffInDays = Math.floor((day.getTime() - baseDate.getTime()) / (1000 * 3600 * 24));

            // weekIndex para a pessoa que COMEÇA na segunda-feira
            // Alinhado para Walter entrar 02/03 e Renato terminar 01/03
            const weekIndex = Math.floor((diffInDays + 10) / 7);
            const currentEmployee = employees[weekIndex % employees.length];

            // weekIndex para a pessoa que TERMINA na segunda-feira (quem estava na semana passada)
            const prevEmployee = employees[(weekIndex - 1 + employees.length) % employees.length];

            const assignments = [];

            // Verificação Dinâmica de Feriado (Funciona para 2026, 2027, etc.)
            const isHoliday = hd.isHoliday(day);

            if (dayOfWeek === 1) {
                // Segunda-feira tem dois responsáveis: S1 (quem sai) e S (quem entra)
                assignments.push({ employee: prevEmployee.name, type: 'S1' });
                assignments.push({ employee: currentEmployee.name, type: 'S' });
            } else if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
                // Finais de semana ou Feriados são SS (24h)
                assignments.push({ employee: currentEmployee.name, type: 'SS' });
            } else {
                // Dias de semana (Ter-Sex)
                assignments.push({ employee: currentEmployee.name, type: 'S' });
            }

            newScale[dateStr] = assignments;
        });

        setScale(newScale);
    };

    useEffect(() => {
        generateScale();
    }, [currentDate, employees]);

    const onCallToday = scale[format(new Date(), 'yyyy-MM-dd')] || [];
    const onCallTomorrow = scale[format(addDays(new Date(), 1), 'yyyy-MM-dd')] || [];

    const exportToExcel = () => {
        // Título e Endereço
        const titleRow = [`ESCALA DE SOBREAVISO - ATENDIMENTO / BACKOFFICE AMERINODE (${format(currentDate, 'MMMM/yyyy', { locale: ptBR }).toUpperCase()})`].concat(Array(36).fill(''));
        const addressRow = ['RUA JAGUARE, 390 - JAGUARE'].concat(Array(36).fill(''));

        // Cabeçalhos de semanas e dias
        const weekStartDates = ['', ''];
        const weekEndDates = ['', ''];
        const weekDaysRow = ['NOME', 'TELEFONE PARA CONTATO'];
        const dayNumbersRow = ['', ''];

        // Agrupar dias por semana (blocos de 7 iniciando no domingo)
        const startOfScale = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        const endOfScale = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
        const scaleDays = eachDayOfInterval({ start: startOfScale, end: endOfScale });

        const numWeeks = Math.ceil(scaleDays.length / 7);

        scaleDays.forEach((day, idx) => {
            const isSameMonth = format(day, 'MM/yyyy') === format(currentDate, 'MM/yyyy');

            // Números e dias da semana
            weekDaysRow.push(format(day, 'EEE', { locale: ptBR }).substring(0, 3).toUpperCase());
            dayNumbersRow.push(format(day, 'd'));

            // Header de semanas (a cada 7 dias)
            if (idx % 7 === 0) {
                weekStartDates.push(format(day, 'dd/MM/yyyy'));
                for (let i = 0; i < 6; i++) { weekStartDates.push(''); }

                weekEndDates.push(format(addDays(day, 6), 'dd/MM/yyyy'));
                for (let i = 0; i < 6; i++) { weekEndDates.push(''); }
            }
        });

        const dataRows = [
            titleRow,
            addressRow,
            weekStartDates,
            weekEndDates,
            weekDaysRow,
            dayNumbersRow
        ];

        // Linhas dos funcionários
        employees.forEach(emp => {
            const row = [emp.name, emp.phone];
            scaleDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAssignments = scale[dateStr] || [];
                // Encontrar se este funcionário está escalado neste dia
                const assignment = dayAssignments.find(a => a.employee === emp.name);
                row.push(assignment ? assignment.type : '');
            });
            dataRows.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        // Mesclagens (Merges)
        const totalCols = 2 + scaleDays.length;
        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // Título
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }, // Endereço
            { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // "NOME" vertical
            { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // "TELEFONE" vertical
        ];

        // Merges de semanas
        for (let i = 0; i < numWeeks; i++) {
            const startCol = 2 + (i * 7);
            merges.push({ s: { r: 2, c: startCol }, e: { r: 2, c: startCol + 6 } }); // Data Início Semana
            merges.push({ s: { r: 3, c: startCol }, e: { r: 3, c: startCol + 6 } }); // Data Fim Semana
        }

        ws['!merges'] = merges;

        // Estilo básico de colunas
        const colWidths = [{ wch: 25 }, { wch: 18 }];
        for (let i = 0; i < scaleDays.length; i++) colWidths.push({ wch: 4 });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Escala");
        XLSX.writeFile(wb, `ESCALA_AMERINODE_${format(currentDate, 'MM_yyyy')}.xlsx`);
    };

    return (
        <div className="app-container">
            <header className="header-mobile" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={32} /> SISO
                    </h1>
                    <p style={{ color: 'var(--text-dim)' }}>Sistema Inteligente de Sobreaviso</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>Anterior</button>
                    <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderRadius: '12px', fontWeight: '700', minWidth: '150px', textAlign: 'center' }}>
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
                    </div>
                    <button className="btn btn-secondary" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>Próximo</button>
                </div>
            </header>

            <nav className="nav-mobile" style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <button
                    className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    <CalendarIcon size={18} /> Dashboard
                </button>
                <button
                    className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('config')}
                >
                    <Users size={18} /> Equipe & Regras
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                        {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
                    </button>
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <Download size={18} /> Exportar Excel
                    </button>
                </div>
            </nav>

            <main style={{ flex: 1 }}>
                {activeTab === 'dashboard' && (
                    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div className="glass-card stat-card" style={{ borderTop: '4px solid var(--accent)' }}>
                                <div className="stat-label">Responsável Hoje</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {onCallToday.length > 0 ? onCallToday.map((p, idx) => (
                                        <div key={idx} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                            <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1.2rem', margin: 0 }}>
                                                {p.employee}
                                            </div>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                                <span className="on-call-badge" style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}>{p.type}</span>
                                                {LEGENDS[p.type]}
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <Clock size={16} /> Sem plantão ativo
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="glass-card stat-card" style={{ borderTop: '4px solid var(--primary)' }}>
                                <div className="stat-label">Responsável Amanhã</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {onCallTomorrow.length > 0 ? onCallTomorrow.map((p, idx) => (
                                        <div key={idx} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                            <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '1.2rem', margin: 0 }}>
                                                {p.employee}
                                            </div>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                                <span className="on-call-badge" style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}>{p.type}</span>
                                                {LEGENDS[p.type]}
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <Clock size={16} /> Sem plantão ativo
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div className="stat-label" style={{ marginBottom: '1rem', textAlign: 'center' }}>Contatos da Equipe</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {employees.map((emp) => (
                                        <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{emp.name}</span>
                                            <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{emp.phone}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="glass-card">
                            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', m: 0 }}>
                                    <CalendarIcon size={24} style={{ color: 'var(--primary)' }} /> Visão Mensal
                                </h2>
                            </div>
                            <div className="calendar-grid">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                    <div key={d} className="calendar-header">{d}</div>
                                ))}

                                {eachDayOfInterval({
                                    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
                                    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
                                }).map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const s = scale[dateStr] || [];
                                    const active = isToday(day);
                                    const isOtherMonth = format(day, 'MM') !== format(currentDate, 'MM');

                                    return (
                                        <div
                                            key={dateStr}
                                            className={`calendar-day ${active ? 'today' : ''}`}
                                            onClick={() => setSelectedDay({ date: day, assignments: s })}
                                            style={{ cursor: 'pointer', overflow: 'hidden', opacity: isOtherMonth ? 0.3 : 1 }}
                                        >
                                            <div className="calendar-day-header">
                                                <span className="day-number">{format(day, 'd')}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {s.map((p, idx) => (
                                                    <div key={idx} style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '0.7rem', opacity: 0.9, background: 'var(--bg-input)', padding: '2px 4px', borderRadius: '4px' }}>{p.type}</span>
                                                        {p.employee.split(' ')[0]}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Legendas */}
                            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                {Object.entries(LEGENDS).map(([code, desc]) => (
                                    <div key={code} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <span className="on-call-badge" style={{ minWidth: '40px', justifyContent: 'center' }}>{code}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Detalhes */}
                {selectedDay && (
                    <div
                        style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
                        }} onClick={() => setSelectedDay(null)}>
                        <div className="glass-card animate-fade" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>
                                {format(selectedDay.date, "dd 'de' MMMM", { locale: ptBR })}
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {selectedDay.assignments && selectedDay.assignments.length > 0 ? selectedDay.assignments.map((p, idx) => (
                                    <div key={idx} style={{ borderBottom: idx < selectedDay.assignments.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '1rem' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{p.employee}</div>
                                        <div className="on-call-badge" style={{ margin: '0.5rem auto', padding: '0.5rem 1rem', fontSize: '1rem' }}>
                                            {p.type}
                                        </div>
                                        <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Disponibilidade</div>
                                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{LEGENDS[p.type]}</div>
                                        </div>
                                    </div>
                                )) : (
                                    <p>Ninguém escalado para este dia.</p>
                                )}
                                <button className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }} onClick={() => setSelectedDay(null)}>Fechar</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="grid grid-cols-12 animate-fade">
                        <div className="col-span-8 glass-card">
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users /> Gestão da Equipe
                            </h2>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {employees.map(emp => (
                                    <div key={emp.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-input)' }}>
                                        <div>
                                            <div style={{ fontWeight: '700' }}>{emp.name}</div>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{emp.phone}</div>
                                        </div>
                                        <button className="btn btn-secondary">Editar</button>
                                    </div>
                                ))}
                                <button className="btn btn-secondary" style={{ borderStyle: 'dashed', justifyContent: 'center' }}>+ Adicionar Membro</button>
                            </div>
                        </div>

                        <div className="col-span-4 glass-card">
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Settings /> Regras de Rodízio
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>Frequência de Troca</label>
                                    <select style={{ width: '100%', cursor: 'pointer' }}>
                                        <option>Diária (1 pessoa/dia)</option>
                                        <option>Semanal (1 pessoa/semana)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>Ordem de Início</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {employees.map((emp, i) => (
                                            <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '10px' }}>
                                                <span style={{ background: 'var(--primary)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>{i + 1}</span>
                                                <span style={{ fontSize: '0.9rem' }}>{emp.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <button className="btn btn-primary" onClick={generateScale} style={{ marginTop: '1rem' }}>
                                    <ArrowRightLeft size={18} /> Re-gerar Escala
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                &copy; 2026 SISO Dashboard - Gestão de Escalas Amerinode
            </footer>
        </div >
    );
}

export default App;
