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
    { id: 1, name: 'RENATO MARTINS', phone: '(11) 93393-4722', role: 'Supervisor de Atendimento' },
    { id: 2, name: 'WALTER ALBERTO', phone: '(11) 95072-0498', role: 'Supervisor de Atendimento' },
    { id: 3, name: 'GUILHERME ALBERTO', phone: '(11) 93256-6628', role: 'Coordenador de Operações' },
    { id: 4, name: 'MARCELO PANHOCA', phone: '(11) 97400-8800', role: 'Gerente' }
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

    const handleEditVacation = (emp) => {
        const pwd = prompt(`Inserir férias para ${emp.name}.\n\nDigite a senha de administrador:`);
        if (pwd === '@Merinode26') {
            alert(`Acesso Liberado!\nA funcionalidade de inserir férias para ${emp.name} está em desenvolvimento no momento.`);
        } else if (pwd !== null) {
            alert("Senha incorreta!");
        }
    };

    // Geração Automática de Escala (7 dias seguidos + Transição na Segunda)
    const generateScale = () => {
        // Agora a escala sempre começa no domingo e termina no sábado
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });

        const days = eachDayOfInterval({ start, end });

        const newScale = {};

        // Filtramos para pegar apenas as pessoas que dão plantão real. Marcelo não entra na rotação.
        const plantonistas = employees.filter(emp => emp.role !== 'Gerente');

        days.forEach((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = getDay(day); // 0 = Dom, 1 = Seg...

            const baseDate = new Date(2026, 0, 1);
            const diffInDays = Math.floor((day.getTime() - baseDate.getTime()) / (1000 * 3600 * 24));

            // weekIndex para a pessoa que COMEÇA na segunda-feira
            // Alinhado para Walter entrar 02/03 e Renato terminar 01/03
            const weekIndex = Math.floor((diffInDays + 10) / 7);
            const currentEmployee = plantonistas[weekIndex % plantonistas.length];

            // weekIndex para a pessoa que TERMINA na segunda-feira (quem estava na semana passada)
            const prevEmployee = plantonistas[(weekIndex - 1 + plantonistas.length) % plantonistas.length];

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <Zap size={32} /> Escala de Sobreaviso
                        </h1>
                        <p style={{ color: 'var(--text-dim)', marginTop: '0.25rem' }}>Gestão e Acompanhamento</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.75rem' }}
                            onClick={() => setActiveTab('dashboard')}
                            title="Dashboard"
                        >
                            <CalendarIcon size={20} />
                        </button>
                        <button
                            className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.75rem' }}
                            onClick={() => setActiveTab('config')}
                            title="Equipe & Regras"
                        >
                            <Users size={20} />
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.75rem' }} onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}>
                        {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '0.75rem' }} onClick={exportToExcel} title="Exportar Excel">
                        <Download size={18} />
                    </button>
                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>Anterior</button>
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderRadius: '12px', fontWeight: '700', minWidth: '150px', textAlign: 'center' }}>
                            {format(currentDate, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
                        </div>
                        <button className="btn btn-secondary" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>Próximo</button>
                    </div>
                </div>
            </header>



            <main style={{ flex: 1 }}>
                {activeTab === 'dashboard' && (
                    <div className="animate-fade dashboard-layout">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="glass-card stat-card" style={{ borderTop: '4px solid var(--accent)' }}>
                                <div className="stat-label">Sobreaviso Hoje</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {onCallToday.length > 0 ? onCallToday.map((p, idx) => (
                                        <div key={idx} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                            <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1.2rem', margin: 0 }}>
                                                {p.employee}
                                            </div>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.5rem 0' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', fontSize: '1rem', lineHeight: '1.4' }}>
                                                    {LEGENDS[p.type].replace(' das ', ' das:\\n').split('\\n').map((line, i) => <div key={i}>{line}</div>)}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.75rem', gap: '0.25rem' }}>
                                                        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Contato:</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <a href={`tel:${employees.find(emp => emp.name === p.employee)?.phone.replace(/[^0-9]/g, '')}`} style={{ color: 'var(--text-dim)', fontSize: '1rem', textDecoration: 'none', fontWeight: 'bold' }}>{employees.find(emp => emp.name === p.employee)?.phone}</a>
                                                            <a href={`https://wa.me/55${employees.find(emp => emp.name === p.employee)?.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: '#25D366' }} title="WhatsApp">
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                                </svg>
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
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
                                <div className="stat-label">Sobreaviso Amanhã</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {onCallTomorrow.length > 0 ? onCallTomorrow.map((p, idx) => (
                                        <div key={idx} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                            <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '1.2rem', margin: 0 }}>
                                                {p.employee}
                                            </div>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.5rem 0' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', fontSize: '1rem', lineHeight: '1.4' }}>
                                                    {LEGENDS[p.type].replace(' das ', ' das:\\n').split('\\n').map((line, i) => <div key={i}>{line}</div>)}
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.75rem', gap: '0.25rem' }}>
                                                        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Contato:</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <a href={`tel:${employees.find(emp => emp.name === p.employee)?.phone.replace(/[^0-9]/g, '')}`} style={{ color: 'var(--text-dim)', fontSize: '1rem', textDecoration: 'none', fontWeight: 'bold' }}>{employees.find(emp => emp.name === p.employee)?.phone}</a>
                                                            <a href={`https://wa.me/55${employees.find(emp => emp.name === p.employee)?.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: '#25D366' }} title="WhatsApp">
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                                </svg>
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
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
                                        <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>{emp.name}</span>
                                            <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>{emp.role}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                                <a href={`tel:${emp.phone.replace(/[^0-9]/g, '')}`} style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textDecoration: 'none' }}>{emp.phone}</a>
                                                <a href={`https://wa.me/55${emp.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: '#25D366' }} title="WhatsApp">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                    </svg>
                                                </a>
                                            </div>
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
                            <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
                                <div className="calendar-grid" style={{ minWidth: '700px' }}>
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
                                                            <span className={`on-call-badge badge-${p.type.toLowerCase()}`} style={{ fontSize: '0.7rem', opacity: 0.9, padding: '2px 4px', borderRadius: '4px' }}>
                                                                {p.type}
                                                            </span>
                                                            {p.employee.split(' ')[0]}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Legendas */}
                            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                {Object.entries(LEGENDS).map(([code, desc]) => (
                                    <div key={code} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                        <span className={`on-call-badge badge-${code.toLowerCase()}`} style={{ minWidth: '40px', justifyContent: 'center' }}>{code}</span>
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
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span className={`on-call-badge badge-${p.type.toLowerCase()}`} style={{ fontSize: '1rem', padding: '0.3rem 0.6rem' }}>{p.type}</span>
                                            <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{p.employee}</div>
                                        </div>
                                        {employees.find(emp => emp.name === p.employee) && (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                                <a href={`tel:${employees.find(emp => emp.name === p.employee).phone.replace(/[^0-9]/g, '')}`} style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textDecoration: 'none' }}>{employees.find(emp => emp.name === p.employee).phone}</a>
                                                <a href={`https://wa.me/55${employees.find(emp => emp.name === p.employee).phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: '#25D366' }} title="WhatsApp">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                    </svg>
                                                </a>
                                            </div>
                                        )}
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
                                    <div key={emp.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-input)', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '700' }}>{emp.name}</div>
                                            <div style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', marginTop: '0.25rem' }}>{emp.role}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                <a href={`tel:${emp.phone.replace(/[^0-9]/g, '')}`} style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textDecoration: 'none' }}>{emp.phone}</a>
                                                <a href={`https://wa.me/55${emp.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: '#25D366' }} title="WhatsApp">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                    </svg>
                                                </a>
                                            </div>
                                        </div>
                                        <button className="btn btn-secondary" onClick={() => handleEditVacation(emp)}>Editar</button>
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
