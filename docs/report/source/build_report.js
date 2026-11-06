/* Builds the MycoFarm final-year project report (.docx), structured after the reference book. */
const fs = require('fs')
const path = require('path')
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, NumberFormat, Packer, PageBreak,
  PageNumber, PageOrientation, Paragraph, ShadingType, StyleLevel, Table, TableCell, TableOfContents, TableRow, TabStopType,
  TextRun, VerticalAlign, WidthType,
} = require('docx')

const R = __dirname
const OUT = process.argv[2]
const SIZES = JSON.parse(fs.readFileSync(path.join(R, 'sizes.json'), 'utf8'))
const FONT = 'Times New Roman'

// ---------------------------------------------------------------- page geometry (A4)
const A4 = { width: 11906, height: 16838 }
const MARGIN = { top: 1440, bottom: 1440, left: 1800, right: 1440, header: 708, footer: 708 }
const PORTRAIT_W = Math.floor((A4.width - MARGIN.left - MARGIN.right) / 15)   // px at 96 dpi (1px = 15 twips)
const LAND_W = Math.floor((A4.height - MARGIN.left - MARGIN.right) / 15)
const LAND_H = Math.floor((A4.width - MARGIN.top - MARGIN.bottom) / 15) - 70

// ---------------------------------------------------------------- inline markup: **bold**, [placeholder]
function runs(text, base = {}) {
  const out = []
  for (const part of String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g)) {
    if (!part) continue
    if (part.startsWith('**')) out.push(new TextRun({ text: part.slice(2, -2), bold: true, ...base }))
    else if (part.startsWith('[')) out.push(new TextRun({ text: part, shading: { type: ShadingType.CLEAR, fill: 'FFF59D', color: 'auto' }, ...base }))
    else out.push(new TextRun({ text: part, ...base }))
  }
  return out
}

// ---------------------------------------------------------------- content blocks (with orientation)
let blocks = []          // { orient: 'P' | 'L', items: [...] }
let orient = 'P'
const push = (...items) => {
  const last = blocks[blocks.length - 1]
  if (last && last.orient === orient) last.items.push(...items)
  else blocks.push({ orient, items })
}
const landscape = (fn) => { orient = 'L'; fn(); orient = 'P' }

const H1 = (t, opts = {}) => push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: opts.newPage !== false, children: [new TextRun(t)], alignment: AlignmentType.CENTER }))
const H2 = (t) => push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }))
const H3 = (t) => push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] }))
const P = (t, o = {}) => push(new Paragraph({ children: runs(t), alignment: o.align ?? AlignmentType.JUSTIFIED, spacing: o.spacing, indent: o.indent }))
const B = (items, level = 0) => items.forEach((t) => push(new Paragraph({ numbering: { reference: 'bullets', level }, children: runs(t), alignment: AlignmentType.JUSTIFIED })))
let listInstance = 0
const N = (items) => { listInstance++; items.forEach((t) => push(new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: listInstance }, children: runs(t), alignment: AlignmentType.JUSTIFIED }))) }
const breakPage = () => push(new Paragraph({ children: [new PageBreak()] }))

let figNo = 0, tabNo = 0
const figures = [], tables = []

function image(file, maxW, maxH = 99999) {
  const [w0, h0] = SIZES[file]
  const isShot = file.endsWith('.jpg')
  const dir = isShot ? 'shots' : 'png'
  // diagrams are rendered at 2x, icons 3x, screenshots 1x (mobile 2x)
  const density = file.startsWith('icon_') ? 3 : isShot ? (file.includes('mobile') ? 2 : 1) : 2
  let w = w0 / density, h = h0 / density
  const s = Math.min(1, maxW / w, maxH / h)
  w = Math.round(w * s); h = Math.round(h * s)
  return new ImageRun({ type: isShot ? 'jpg' : 'png', data: fs.readFileSync(path.join(R, dir, file)), transformation: { width: w, height: h } })
}

function figure(file, caption, o = {}) {
  figNo++
  figures.push(caption)
  const maxW = o.maxW ?? (orient === 'L' ? LAND_W : PORTRAIT_W)
  const maxH = o.maxH ?? (orient === 'L' ? LAND_H : 760)
  if (o.title) push(new Paragraph({ children: [new TextRun({ text: o.title, bold: true })], alignment: AlignmentType.CENTER, keepNext: true }))
  push(new Paragraph({ children: [image(file, maxW, maxH)], alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 } }))
  push(new Paragraph({ style: 'FigureCaption', children: [new TextRun(`Figure ${figNo}: ${caption}`)] }))
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' }
const borders = { top: border, bottom: border, left: border, right: border }
function cell(content, width, o = {}) {
  const kids = Array.isArray(content) ? content : [new Paragraph({ children: o.header ? [new TextRun({ text: String(content), bold: true, size: 20 })] : runs(content, { size: 20 }), spacing: { before: 40, after: 40, line: 260 }, alignment: o.align ?? AlignmentType.LEFT })]
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: o.header ? { fill: 'DFE8DC', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: kids,
  })
}
function table(caption, header, rows, widths) {
  tabNo++
  tables.push(caption)
  const total = widths.reduce((a, b) => a + b, 0)
  push(new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, widths[i], { header: true })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i])) }))],
  }))
  push(new Paragraph({ style: 'TableCaption', children: [new TextRun(`Table ${tabNo}: ${caption}`)] }))
}
function elementsTable(caption, rows) {   // rows: [term, description, iconFile]
  const widths = [1900, 4366, 2400]
  const rowsOut = rows.map(([t, d, ic]) => [t, d, [new Paragraph({ alignment: AlignmentType.CENTER, children: [image(ic, 140, 80)] })]])
  table(caption, ['Term', 'Description', 'Illustration'], rowsOut, widths)
}

// ================================================================= placeholders & constants
const STUDENT = 'MUHAWENIMANA Josee'
const REG = '[__________]'
const SUP = '[Supervisor’s Name]'
const FAC = '[Faculty of …]'
const DEPT = '[Department of …]'
const PROG = '[Programme / Degree Title]'
const MAJOR = '[Option / Specialisation]'
const CASE = '[Case Study Farm Name]'
const DATE = '[Month, Year]'
const SYS = 'MycoFarm – Mushroom Farm Management System'

// ================================================================= FRONT MATTER (after cover)
const front = []
const F = (p) => front.push(p)
const center = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 120 }, children: runs(t, { bold: o.bold, size: o.size }) })

// --- Abstract sheet (mirrors page i of the book)
F(center('CATHOLIC UNIVERSITY OF RWANDA', { bold: true }))
F(center(`A Final Year Project for the ${PROG}`))
F(center(`Emphasis in ${MAJOR}`, { after: 240 }))
F(new Paragraph({ children: runs(`**Title:** ${SYS}`) }))
F(new Paragraph({ children: runs(`**Name of the Researcher:** ${STUDENT}`) }))
F(new Paragraph({ children: runs(`**Registration Number:** ${REG}`) }))
F(new Paragraph({ children: runs(`**Name of Supervisor:** ${SUP}`) }))
F(new Paragraph({ children: runs(`**Date Completed:** ${DATE}`), spacing: { after: 240 } }))
F(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun('ABSTRACT')] }))
for (const t of [
  'Mushroom farming is a fast-growing agricultural activity that offers high value per square metre, short production cycles and income opportunities for smallholder farmers and cooperatives. However, most mushroom farms still manage their operations with notebooks, paper receipts and disconnected spreadsheets. Production batches, growth conditions, harvest flushes, stock and sales are recorded in different places, which makes it difficult to know the real yield of a batch, to detect contamination early, to keep stock accurate and to understand whether the farm is profitable.',
  `This project presents the design and implementation of **${SYS}**, a web-based, multi-tenant platform that digitises the complete mushroom production lifecycle: substrate preparation, sterilisation, spawning, incubation, pinning, fruiting, harvesting and sales. The system tracks every production batch with a unique code and a full history of stage transitions, records periodic growth observations with automatic environmental and contamination alerts, manages multiple harvest flushes with a manager approval workflow, updates fresh-mushroom stock automatically from approved harvests, and deducts stock from the oldest lots first when a sale is made. It also manages customers, payments, invoices, expenses, staff and tasks, and provides dashboards, reports and notifications.`,
  'The solution was developed with React, TypeScript, Vite, Tailwind CSS and shadcn/ui on the frontend, a Python Flask REST API on the backend, and MongoDB as the database. Security is enforced through hashed passwords, JSON Web Tokens with refresh-token rotation, role-based access control for five user roles (Super Admin, Farm Owner, Farm Manager, Farm Worker and Sales Manager) and strict data isolation between organisations. Testing with automated API scenarios and browser end-to-end tests confirmed that the main workflows behave correctly and that one organisation can never read or modify another organisation’s data. The expected outcome is better traceability, fewer losses, accurate stock and data-driven decisions for mushroom farm owners.',
]) F(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runs(t) }))
F(new Paragraph({ children: runs(`**Keywords:** mushroom farm management, production tracking, harvest management, inventory, multi-tenant web application, Flask, React, MongoDB.`) }))

// --- Declaration
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [new TextRun('DECLARATION')] }))
F(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runs(`I, **${STUDENT}**, with Registration No ${REG}, a student at the Catholic University of Rwanda in the ${FAC}, ${DEPT}, hereby declare that this project report, entitled “${SYS}”, is my own original work and has not been submitted, in whole or in part, for the award of any degree or diploma in this or any other institution. Where the work of others has been used, it has been duly acknowledged.`) }))
F(new Paragraph({ spacing: { before: 600 }, children: [new TextRun('Signature: ……………………………………….')] }))
F(new Paragraph({ children: [new TextRun('Date: ………/……………………/…………….')] }))

// --- Approval
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [new TextRun('APPROVAL')] }))
F(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runs(`I, ${SUP}, hereby certify that this project report, entitled “${SYS}”, has been carried out by **${STUDENT}** (Reg. No ${REG}) under my supervision and is submitted with my approval.`) }))
F(new Paragraph({ spacing: { before: 600 }, children: [new TextRun('Signature: ……………………………………….')] }))
F(new Paragraph({ children: [new TextRun('Date: ………/……………………/…………….')] }))

// --- Dedication
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { before: 2400 }, children: [new TextRun('DEDICATION')] }))
for (const t of [
  'To the Almighty God, for the gift of life, wisdom and strength throughout my studies,',
  'To my beloved family, whose love, sacrifices and encouragement have carried me this far,',
  `To my supervisor, ${SUP}, whose guidance shaped this work,`,
  'To my friends and classmates, for the companionship and support along the journey,',
  'And to every mushroom farmer working to feed our communities,',
  'I dedicate this work.',
]) F(new Paragraph({ alignment: AlignmentType.CENTER, children: runs(t, { italics: true }) }))

// --- Acknowledgements
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [new TextRun('ACKNOWLEDGEMENTS')] }))
for (const t of [
  'First and foremost, I thank God Almighty for His grace, protection and guidance throughout my academic journey and during the completion of this project.',
  `My sincere gratitude goes to the **Catholic University of Rwanda** for providing a conducive environment for learning and personal growth. I am thankful to the lecturers and staff of the ${FAC} and the ${DEPT} for the knowledge and skills they shared with me.`,
  `I extend special thanks to my supervisor, **${SUP}**, for the valuable guidance, patience and constructive feedback that greatly improved the quality of this work.`,
  `I am grateful to the management and staff of ${CASE} for their time, for answering my questions and for sharing their experience of day-to-day mushroom farm operations.`,
  'To my family, thank you for your unconditional love, prayers and support. To my friends and classmates, thank you for the encouragement and the shared moments that made this journey memorable.',
  'Finally, I thank everyone who contributed, directly or indirectly, to the completion of this project. May God bless you all.',
]) F(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runs(t) }))
F(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 240 }, children: [new TextRun({ text: STUDENT, bold: true })] }))

// --- TOC & lists
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [new TextRun('TABLE OF CONTENTS')] }))
F(new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }))
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [new TextRun('LIST OF FIGURES')] }))
F(new TableOfContents('List of Figures', { hyperlink: true, stylesWithLevels: [new StyleLevel('Figure Caption', 1)] }))
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [new TextRun('LIST OF TABLES')] }))
F(new TableOfContents('List of Tables', { hyperlink: true, stylesWithLevels: [new StyleLevel('Table Caption', 1)] }))
F(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [new TextRun('LIST OF ABBREVIATIONS')] }))
const abbr = [['API', 'Application Programming Interface'], ['CRUD', 'Create, Read, Update, Delete'], ['CSV', 'Comma-Separated Values'],
  ['CUR', 'Catholic University of Rwanda'], ['ERD', 'Entity Relationship Diagram'], ['FIFO', 'First In, First Out'],
  ['HTTP(S)', 'HyperText Transfer Protocol (Secure)'], ['JSON', 'JavaScript Object Notation'], ['JWT', 'JSON Web Token'],
  ['KPI', 'Key Performance Indicator'], ['NoSQL', 'Not only SQL (non-relational database)'], ['RBAC', 'Role-Based Access Control'],
  ['REST', 'Representational State Transfer'], ['RWF', 'Rwandan Franc'], ['SPA', 'Single-Page Application'],
  ['UI / UX', 'User Interface / User Experience'], ['UML', 'Unified Modelling Language']]
F(new Table({ width: { size: 8600, type: WidthType.DXA }, columnWidths: [2000, 6600],
  rows: abbr.map(([a, b]) => new TableRow({ children: [cell(`**${a}**`, 2000), cell(b, 6600)] })) }))

// ================================================================= CHAPTER 1
H1('CHAPTER 1: GENERAL INTRODUCTION')
H2('1.1 Introduction')
P('Mushroom cultivation has become an attractive agricultural activity because it requires little land, uses agricultural residues such as straw, sawdust and bran as substrate, and produces a high-value crop within a few weeks. Oyster, button, shiitake and king oyster mushrooms are grown in controlled rooms where temperature, humidity and ventilation strongly influence the final yield. A single farm may run many production batches at the same time, each moving through several stages and producing several harvests (called flushes) before the substrate is exhausted.')
P('Running such an operation requires accurate information: which batches are in which stage, when the next harvest is expected, how much was harvested and rejected, how much fresh stock is available before it spoils, which customers owe money and what each kilogram costs to produce. In many farms this information is still kept in notebooks, on paper receipts and in scattered spreadsheets. As production grows, these manual practices lead to lost records, late detection of contamination, inaccurate stock, unpaid invoices and decisions taken without reliable data.')
P(`This project, **${SYS}**, proposes a modern web application that brings all farm operations into a single, secure and easy-to-use platform. The system follows each production batch from substrate preparation to completion, captures growth observations and harvests, automatically maintains mushroom stock, records sales and expenses, and turns this data into dashboards and reports. Because many independent farms and cooperatives can use the same platform, it was designed as a multi-tenant application in which each organisation’s data is completely isolated from the others.`)
H2('1.2 Background of the Study')
P('Agriculture remains a major source of livelihood and employment, and diversification into high-value crops is encouraged to improve farmers’ incomes and nutrition. Mushroom farming fits this objective well: production cycles are short, the product is nutritious, and the activity can be practised by smallholders, youth and women’s cooperatives as well as by commercial growers supplying hotels, supermarkets and restaurants.')
P('Mushroom production, however, is a sensitive biological process. Each variety has its own incubation and fruiting duration and its own recommended temperature and humidity range. Contamination by competing moulds can destroy a large share of the growing bags if it is not detected and isolated quickly. Fresh mushrooms have a short shelf life of only a few days, so harvested stock must be sold quickly and in the right order. Farms therefore need timely, accurate and connected information to keep losses low and to plan production and sales.')
P(`At ${CASE}, the case study for this project, [describe the size of the farm, the varieties grown, the number of rooms and staff, and the current way records are kept]. These conditions are typical of many mushroom farms that have grown beyond what paper records can manage reliably.`)
P('Advances in web technologies, affordable smartphones and internet connectivity now make it possible to give farm owners, managers, workers and sales staff a shared digital tool accessible from any device. This study responds to that opportunity by developing a dedicated mushroom farm management system that reflects the real workflow of a mushroom farm instead of a generic agricultural record book.')
H2('1.3 Statement of the Problem')
P('Mushroom farms that rely on manual record-keeping face recurring problems that reduce productivity and profitability. The specific problems identified include:')
B(['Production batches are recorded in notebooks without unique codes, making it hard to trace a harvest back to its substrate, room and spawning date.',
  'Growth conditions (temperature, humidity, contamination) are noted irregularly, so problems are discovered late and losses increase.',
  'Harvests from several flushes are not consolidated, so the actual yield per batch and per growing bag compared with the expected yield is unknown.',
  'Fresh-mushroom stock is checked physically; there is no reliable view of available quantities, expiry dates or losses.',
  'Sales, partial payments and outstanding customer balances are kept on paper receipts, leading to errors and unpaid debts.',
  'Expenses are not linked to production, so the cost per kilogram and the real profit are estimated rather than measured.',
  'Owners lack real-time dashboards and reports, and there is no control over who can view or modify which information.'])
P('There is therefore a need for a centralised, secure and automated system that manages the entire mushroom production lifecycle and the related business operations, and that gives each farm a clear, data-driven view of its performance.')
H2('1.4 Choice and Motivation of the Study')
H3('1.4.1 To the Catholic University of Rwanda')
P('This project applies the knowledge acquired during the programme (software engineering, databases, web development, information security and systems analysis) to a real agricultural problem. It contributes to the university’s mission of producing graduates who use technology to solve problems in their communities, and it can serve as a reference for future projects that combine ICT and agriculture.')
H3(`1.4.2 To the Case Study (${CASE})`)
P('The system gives the farm a single place to manage batches, harvests, stock, customers and finances. It reduces paperwork, improves traceability, provides early warnings for contamination and out-of-range conditions, and supports better production and sales decisions through accurate reports. Because it is multi-tenant, the same platform can also be offered to partner farms and cooperatives.')
H3('1.4.3 To the Student')
P('The project allowed me to design and build a complete, production-style application, from requirements gathering and UML modelling to a secure REST API, a responsive user interface, testing and documentation. It strengthened my skills in full-stack development and in translating real business processes into software.')
H2('1.5 Objectives of the Study')
H3('1.5.1 General Objective')
P('The general objective of this study is to design and develop a web-based, multi-tenant Mushroom Farm Management System that automates the management of the mushroom production lifecycle, harvests, inventory, sales and finances, in order to improve traceability, reduce losses and support data-driven decision-making.')
H3('1.5.2 Specific Objectives')
N(['To implement secure user authentication with role-based access control for Super Admins, Farm Owners, Farm Managers, Farm Workers and Sales Managers, with strict isolation of each organisation’s data.',
  'To develop modules for managing farms, cultivation rooms and mushroom varieties with their recommended growing conditions.',
  'To track production batches through all lifecycle stages, keeping a complete history of stage transitions and periodic growth observations.',
  'To manage multiple harvest flushes with an approval workflow that automatically updates mushroom stock.',
  'To manage inventory, customers, sales orders, payments, invoices and expenses, with automatic stock deduction on sales.',
  'To provide dashboards, notifications and exportable reports on production, harvests, sales, finances and inventory.'])
H2('1.6 Scope of the Project')
P('The project covers the following functional areas:')
B(['**Organisations and users:** self-registration of farm owners (each registration creates an isolated organisation), user and role management, and a super-admin console for managing tenants.',
  '**Farm management:** farms, cultivation rooms (capacity, temperature, humidity, ventilation) and mushroom varieties.',
  '**Production management:** production batches, the eight lifecycle stages, stage history, growth observations and production alerts.',
  '**Harvest management:** harvest records per flush, grading, rejected quantities, approval workflow and yield analysis.',
  '**Inventory:** fresh-mushroom stock lots with expiry dates, farm supplies with minimum levels, and a full transaction history.',
  '**Sales and finance:** customers, multi-product sales orders, payments, invoices, returns, expenses and profit and loss.',
  '**Staff, reports and notifications:** employees, tasks, dashboards, reports with CSV export and print-to-PDF, and in-app notifications.'])
P('The system is a responsive web application accessed through a browser on desktop, tablet or mobile. Native mobile applications, IoT sensor integration for automatic temperature and humidity capture, online payment gateways and e-mail/SMS delivery are outside the current scope and are proposed as future enhancements.')
H2('1.7 Methodologies and Techniques Used in the Study')
P('Both qualitative data collection methods and a structured software development approach were used to understand the problem and to build the system.')
H3('1.7.1 Documentation')
P('Books, academic articles, online documentation and existing farm-management solutions were reviewed to understand mushroom cultivation practices (substrate preparation, spawning, incubation, fruiting and flushes), farm record-keeping, and best practices in web application security and design. Technical documentation of React, Flask and MongoDB guided the implementation choices.')
H3('1.7.2 Interview')
P(`Interviews were conducted with ${CASE} staff, including [the farm owner, the farm manager, farm workers and the person responsible for sales], to understand current procedures, challenges and expectations. Sample questions included:`)
P('**Q1:** How do you currently record production batches, growth conditions and harvests?')
P('**Answer:** [Summarise the respondents’ answers].')
P('**Q2:** How do you know how much stock is available and which customers still owe money?')
P('**Answer:** [Summarise the respondents’ answers].')
P('**Q3:** What are the main causes of losses on the farm, and how are they detected?')
P('**Answer:** [Summarise the respondents’ answers].')
H3('1.7.3 Observation')
P('[Describe direct observation of the farm’s daily activities, for example how substrate is prepared, how rooms are inspected, and how harvests are weighed and sold.] Observation helped confirm the information collected during interviews and revealed steps that are not documented anywhere.')
H3('1.7.4 Development Methodology')
P('An iterative and incremental (Agile) approach was adopted. The system was built in phases (foundation and authentication; farm management; production management; harvests and inventory; sales and finance; reports and notifications; testing), and each phase was demonstrated and refined before moving to the next. UML was used for analysis and design, and automated tests were run after each increment.')
H2('1.8 Expected Results')
B(['**Improved traceability:** every batch has a unique code and a complete history from substrate preparation to completion.',
  '**Reduced losses:** contamination reports and out-of-range temperature or humidity readings immediately generate alerts.',
  '**Accurate stock:** approved harvests add stock and sales deduct it automatically, oldest lots first, with expiry tracking.',
  '**Better financial control:** sales, payments, outstanding balances and expenses are recorded, giving real profit and cost per kilogram.',
  '**Data-driven decisions:** dashboards and reports summarise production, harvest performance, sales and inventory.',
  '**Scalability:** the multi-tenant design allows many farms and cooperatives to use the same platform securely.'])
H2('1.9 Organization of the Work')
P('This report is organised into five chapters.')
P('**Chapter One: General Introduction** presents the background, the problem statement, the motivation, the objectives, the scope and the methodology of the study.')
P('**Chapter Two: Analysis of the Current System** describes and models the current manual way of managing mushroom farm operations, identifies its problems, proposes solutions and defines the functional and non-functional requirements.')
P('**Chapter Three: Requirements Analysis and Design of the System** presents the design of the new system using UML (use case, class, sequence and activity diagrams), the database diagram, the data dictionary and the system architecture.')
P('**Chapter Four: Implementation and Testing of the New System** describes the technologies used, the implementation process, the presentation of the new system through screenshots, the testing performed and the hardware and software requirements.')
P('**Chapter Five: Conclusion and Recommendations** summarises the work, discusses its contribution and limitations, and proposes recommendations and future improvements.')

// ================================================================= CHAPTER 2
H1('CHAPTER 2: ANALYSIS OF THE CURRENT SYSTEM')
H2('2.1 Introduction')
P('System analysis consists of studying how work is currently done in order to understand its strengths and weaknesses and to identify what a new system must provide. This chapter describes the environment of the case study, the current manual process of managing a mushroom farm, the problems of that process, and the requirements of the proposed system.')
P('At present, most mushroom farm activities are managed manually or semi-manually. Batch information is written in notebooks, temperature and humidity are noted on paper when time allows, harvests are weighed and recorded in a logbook, and sales are documented with paper receipts. A spreadsheet may be used to summarise figures weekly or monthly. These practices make it difficult to obtain a reliable, up-to-date view of production, stock and finances.')
H2('2.2 Description of the Current System Environment')
H3('2.2.1 Historical Background')
P(`[Provide the history of ${CASE}: when and by whom it was founded, its location, its growth over the years, the mushroom varieties produced, its main customers and its number of employees.]`)
H3('2.2.2 Mission')
P(`[State the mission of ${CASE}.]`)
H3('2.2.3 Vision')
P(`[State the vision of ${CASE}.]`)
H3('2.2.4 Description of the Current System')
B(['**Production records:** batch information (substrate, spawning date, number of bags) is written in notebooks without unique identifiers; stage changes are not dated consistently.',
  '**Growth monitoring:** room conditions and contamination are noted irregularly on paper; there is no comparison with the recommended range of each variety.',
  '**Harvest recording:** harvests are weighed and written in a logbook; flushes of the same batch are not consolidated, and rejected quantities are rarely recorded.',
  '**Stock management:** available stock is checked physically in the cold room; expired or damaged stock is not systematically recorded.',
  '**Sales and payments:** orders are received by phone or in person and recorded on paper receipts; partial payments and debts are hard to follow.',
  '**Expenses and reporting:** expenses are collected in a file and reconciled monthly; profit and cost per kilogram are estimated manually.'])
H2('2.3 Modelling the Current System')
P('Figure 1 models the current manual process using an activity diagram with swim lanes for the farm worker, the farm manager, the farm owner and the sales function.')
figure('fig01_current_system.png', 'Modelling the Current System', { title: 'Modelling the Current System', maxH: 640 })
H2('2.4 Problems with the Current System')
P('The problems of the current system are analysed using the PIECES framework (Performance, Information, Economics, Control, Efficiency and Service).')
H3('Performance')
B(['**Throughput:** compiling weekly figures from notebooks takes hours and delays decisions.', '**Response time:** contamination and out-of-range conditions are discovered late, after losses have already occurred.'])
H3('Information')
B(['**Input:** handwritten records are incomplete, inconsistent and sometimes illegible.', '**Output:** there is no real-time view of batches, expected harvests, stock or outstanding payments.', '**Storage:** paper records can be lost or damaged and are difficult to search.'])
H3('Economics')
B(['Unrecorded losses, expired stock and unpaid customer balances reduce income.', 'Without linking expenses to production, the cost per kilogram and the real profit are unknown.'])
H3('Control')
B(['**Security:** anyone with access to the notebooks can read or change records; there is no accountability.', '**Consistency:** the same information is copied several times, leading to contradictions between records.'])
H3('Efficiency')
B(['The same data is written in notebooks, then copied to spreadsheets, then summarised again for reports.'])
H3('Service')
B(['Customers may be told that stock is available when it is not, or receive late or inaccurate invoices.'])
H2('2.5 Proposed Solutions')
P(`The proposed **${SYS}** replaces the manual process with a centralised web application. Its main solutions are:`)
B(['**Centralised, multi-tenant platform:** each farm or cooperative registers its own organisation; all its farms, users and data are isolated from other organisations.',
  '**Production lifecycle tracking:** batches with unique codes, the eight production stages with a complete transition history, and expected incubation, harvest and yield calculated from the variety.',
  '**Growth monitoring and alerts:** periodic observations with automatic alerts for contamination and conditions outside the recommended range.',
  '**Harvest workflow:** flush-by-flush harvest records submitted by workers and approved by managers; approval automatically creates fresh-mushroom stock.',
  '**Automatic inventory:** stock lots with grade, expiry date and location; sales deduct stock oldest-first; supplies with minimum levels and low-stock alerts.',
  '**Sales and finance:** customers, multi-product orders, discounts, partial payments, invoices, returns, expenses and profit and loss.',
  '**Dashboards, reports and notifications:** real-time KPIs and charts, exportable reports and in-app notifications for important events.',
  '**Security:** hashed passwords, token-based authentication, role-based permissions enforced by the server, and an audit trail.'])
H2('2.6 System Requirements')
H3('2.6.1 Functional Requirements')
const freq = [
  ['REQ 1: User Registration and Authentication', 'Farm owners shall register an account, which creates a new organisation; all users shall log in securely and log out; users shall be able to reset a forgotten password.'],
  ['REQ 2: Role-Based Access Control', 'The system shall support the roles Super Admin, Farm Owner, Farm Manager, Farm Worker and Sales Manager, and shall restrict each function to the authorised roles.'],
  ['REQ 3: Tenant Management', 'The Super Admin shall create, view, suspend and reactivate organisations; users of a suspended organisation shall not be able to sign in.'],
  ['REQ 4: Farm, Room and Variety Management', 'Owners shall manage farms and cultivation rooms; varieties shall store incubation and fruiting durations, expected yield and recommended conditions.'],
  ['REQ 5: Production Batch Management', 'Managers shall create production batches with a unique code and move them through the eight lifecycle stages; every transition shall be recorded with user, date and notes.'],
  ['REQ 6: Growth Monitoring', 'Workers and managers shall record observations (temperature, humidity, condition, contamination); the system shall raise alerts for contamination and out-of-range readings.'],
  ['REQ 7: Harvest Management', 'Workers shall record harvests per flush; managers shall approve or reject them; approved harvests shall update stock and the batch’s harvested quantity.'],
  ['REQ 8: Inventory Management', 'The system shall maintain fresh-mushroom stock lots and farm supplies, record stock received, consumed, adjusted, damaged or expired, and alert on low stock.'],
  ['REQ 9: Sales and Customer Management', 'Sales staff shall manage customers and create multi-product orders; the system shall compute totals, deduct stock, record payments, track balances and print invoices.'],
  ['REQ 10: Expense Management', 'Managers shall record expenses by category and optionally link them to a production batch.'],
  ['REQ 11: Staff and Task Management', 'Managers shall register employees and assign tasks with deadlines and priorities.'],
  ['REQ 12: Dashboards, Reports and Notifications', 'The system shall show KPIs and charts, generate production, harvest, sales, financial and inventory reports with export, and notify users of important events.'],
]
freq.forEach(([t, d]) => { push(new Paragraph({ children: [new TextRun({ text: t, bold: true })], keepNext: true })); B([d]) })
H3('2.6.2 Non-Functional Requirements')
const nfr = [['Security', 'Passwords shall be hashed; access shall require valid tokens; permissions and organisation isolation shall be enforced by the server.'],
  ['Performance', 'Common pages shall load within a few seconds on a standard connection; lists shall be paginated and analytics computed with database aggregations.'],
  ['Scalability', 'The system shall support many organisations, farms and users without redesign.'],
  ['Usability', 'The interface shall be clean, consistent and easy to learn, with clear feedback, empty states and confirmations for destructive actions.'],
  ['Accessibility and Responsiveness', 'The application shall work in modern browsers on desktop, tablet and mobile, in light and dark themes.'],
  ['Reliability and Integrity', 'Critical operations (harvest approval, stock deduction) shall be protected against double processing and negative stock.'],
  ['Maintainability', 'The code shall be modular, organised by feature, and documented.'],
  ['Auditability', 'Important operations shall be recorded in an audit log.']]
nfr.forEach(([t, d], i) => { push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${t}`, bold: true })], keepNext: true })); B([`REQ ${i + 1}: ${d}`]) })

// ================================================================= CHAPTER 3
H1('CHAPTER 3: REQUIREMENTS ANALYSIS AND DESIGN OF THE SYSTEM')
H2('3.1 Introduction')
P('This chapter translates the requirements identified in Chapter Two into a technical design. It uses the Unified Modelling Language (UML) to describe the actors and functions of the system, its structure and its behaviour, then presents the database design, the data dictionary and the overall architecture. The design emphasises security, data isolation between organisations, maintainability and scalability.')
H2('3.2 Unified Modelling Language (UML)')
P('The Unified Modelling Language is a standard visual language for specifying, constructing and documenting software systems. UML diagrams reduce ambiguity in requirements, improve communication between stakeholders and developers, and serve as documentation for future maintenance. The following UML diagrams were used in this project: use case, class, sequence and activity diagrams.')
H3('3.2.1 Use Case Diagram')
P('A use case diagram shows the interactions between users (actors) and the system. The actors of the Mushroom Farm Management System are:')
B(['**Super Admin:** manages the platform, organisations (tenants) and users.', '**Farm Owner:** manages the organisation’s farms, rooms, varieties, users, expenses and reports.',
  '**Farm Manager:** manages daily operations: batches, stage changes, harvest approvals, inventory and tasks.', '**Farm Worker:** records growth observations, contamination and harvests, and views assigned tasks.',
  '**Sales Manager:** manages customers, sales orders, payments and invoices.'])
elementsTable('Elements of a Use Case Diagram', [
  ['Actor', 'A role played by a user or external system that interacts with the system.', 'icon_uc_actor.png'],
  ['Use case', 'A function or service that the system provides to an actor.', 'icon_uc_usecase.png'],
  ['System boundary', 'A rectangle that separates the functions of the system from the actors outside it.', 'icon_uc_boundary.png'],
  ['Include / Extend', 'A dependency in which one use case always (include) or optionally (extend) uses another.', 'icon_uc_include.png'],
  ['Association', 'A line connecting an actor to a use case it participates in.', 'icon_association.png'],
])
landscape(() => figure('fig02_use_case.png', 'Use Case Diagram of the Mushroom Farm Management System', { title: 'Use Case Diagram of the Mushroom Farm Management System' }))
H3('3.2.2 Class Diagram')
P('A class diagram is a blueprint of the objects in the system. It shows the classes, their attributes and methods, and the relationships between them, such as association, aggregation, composition and inheritance. Class diagrams help to conceptualise the system structure, define object properties and behaviours, and identify design problems early.')
elementsTable('Elements of a Class Diagram', [
  ['Class', 'A blueprint defining the properties and behaviours of a set of similar objects.', 'icon_class.png'],
  ['Attribute', 'A characteristic of an object, representing a specific piece of data it holds.', 'icon_attribute.png'],
  ['Method', 'An operation or behaviour that an object can perform.', 'icon_method.png'],
  ['Inheritance', 'A hierarchical relationship where a subclass inherits properties and behaviours from a superclass.', 'icon_inheritance.png'],
  ['Association', 'A connection between two classes, with multiplicities indicating how many objects are related.', 'icon_association.png'],
  ['Aggregation', 'A whole–part relationship in which the parts can exist independently of the whole.', 'icon_aggregation.png'],
  ['Composition', 'A strong whole–part relationship in which the parts cannot exist without the whole.', 'icon_composition.png'],
])
landscape(() => figure('fig03_class_diagram.png', 'Class Diagram of the Mushroom Farm Management System', { title: 'Class Diagram of the Mushroom Farm Management System' }))
H3('3.2.3 Sequence Diagram')
P('A sequence diagram shows how objects interact over time to accomplish a use case. It represents the participants as lifelines and the messages they exchange in chronological order. Sequence diagrams help to understand object collaboration, identify bottlenecks and document system behaviour for development, testing and maintenance.')
elementsTable('Elements of a Sequence Diagram', [
  ['Actor', 'The user or external system that initiates the interaction.', 'icon_seq_actor.png'],
  ['Lifeline', 'A vertical dashed line representing the existence of a participant during the interaction.', 'icon_seq_lifeline.png'],
  ['Object', 'An instance of a class or component participating in the interaction.', 'icon_seq_object.png'],
  ['Message', 'A call or signal sent from one participant to another; dashed arrows represent replies.', 'icon_seq_message.png'],
  ['Activation bar', 'A thin rectangle on a lifeline showing when a participant is actively processing.', 'icon_seq_activation.png'],
])
landscape(() => {
  figure('fig04_seq_register.png', 'Sequence Diagram of Registration (Sign Up)', { title: 'Sequence Diagram of Registration' })
  figure('fig05_seq_login.png', 'Sequence Diagram of Login', { title: 'Sequence Diagram of Login' })
  figure('fig06_seq_harvest.png', 'Sequence Diagram of Harvest Recording and Approval', { title: 'Sequence Diagram of Harvest Recording and Approval' })
  figure('fig07_seq_sale.png', 'Sequence Diagram of Creating a Sales Order', { title: 'Sequence Diagram of Creating a Sales Order' })
})
H3('3.2.4 Activity Diagram')
P('An activity diagram describes the flow of activities in a process, including decisions and alternative paths, and the actor responsible for each activity using swim lanes. It helps to understand complex processes, model user workflows and identify edge cases.')
elementsTable('Elements of an Activity Diagram', [
  ['Activity', 'A specific step or action within the process.', 'icon_act_activity.png'],
  ['Action flow', 'An arrow connecting activities, indicating the order of the process.', 'icon_act_flow.png'],
  ['Decision node', 'A diamond representing a point where the flow follows one of several paths.', 'icon_act_decision.png'],
  ['Swim lane', 'A band grouping the activities performed by the same actor or component.', 'icon_act_swimlane.png'],
  ['Start node', 'The starting point of the activity diagram.', 'icon_act_start.png'],
  ['End activity node', 'The end of the whole activity.', 'icon_act_end.png'],
  ['Flow final node', 'The end of one particular flow, not of the whole activity.', 'icon_act_flowfinal.png'],
])
figure('fig08_activity.png', 'Activity Diagram of the Mushroom Farm Management System', { title: 'Activity Diagram of the Mushroom Farm Management System', maxH: 700 })
H2('3.3 Database Diagram')
P('A database diagram, or Entity Relationship Diagram (ERD), shows the entities stored in the database and the relationships between them. The system uses MongoDB, a document-oriented NoSQL database; each entity is stored as a collection, and relationships are represented by ObjectId references. Some data that is always read together with its parent, such as the items and payments of a sales order, is embedded inside the parent document.')
elementsTable('Elements of a Database Diagram', [
  ['Entity', 'A real-world object or concept about which data is stored (a MongoDB collection).', 'icon_db_entity.png'],
  ['Attribute / Field', 'A characteristic of an entity; PK marks the primary key and FK a reference to another entity.', 'icon_db_attribute.png'],
  ['Relationship', 'A connection between two entities, showing how their data is related.', 'icon_db_relationship.png'],
  ['Cardinality', 'The number of occurrences of one entity related to another (one-to-one, one-to-many, many-to-many).', 'icon_db_cardinality.png'],
])
landscape(() => figure('fig09_erd.png', 'Database Diagram (ERD) of the Mushroom Farm Management System', { title: 'Database Diagram of the Mushroom Farm Management System' }))
H2('3.4 Data Dictionary')
P('The data dictionary describes the main collections of the database, their fields, data types, constraints and meaning. All collections also contain created_at and updated_at timestamps, and most contain a deleted_at field used for soft deletion.')
const DD = [
  ['Organizations', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier of the organisation (tenant).'], ['name', 'String', 'NOT NULL', 'Name of the farm business or cooperative.'], ['status', 'String', "DEFAULT 'active'", 'active or suspended.'], ['owner_id', 'ObjectId', 'FOREIGN KEY → users', 'The farm owner who created the organisation.']]],
  ['Users', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier of the user.'], ['org_id', 'ObjectId', 'FOREIGN KEY → organizations', 'Organisation of the user (empty for Super Admin).'], ['name', 'String', 'NOT NULL', 'Full name.'], ['email', 'String', 'NOT NULL, UNIQUE', 'Login e-mail address.'], ['password_hash', 'String', 'NOT NULL', 'Salted hash of the password.'], ['role', 'String', 'NOT NULL', 'super_admin, farm_owner, farm_manager, farm_worker or sales_manager.'], ['farm_ids', 'ObjectId[]', 'FOREIGN KEY → farms', 'Farms the user may access.'], ['active', 'Boolean', 'DEFAULT true', 'Whether the account is enabled.']]],
  ['Farms', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier of the farm.'], ['org_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Owning organisation.'], ['code', 'String', 'NOT NULL, UNIQUE per org', 'Short farm code.'], ['name', 'String', 'NOT NULL', 'Farm name.'], ['location', 'String', 'NOT NULL', 'Physical location.'], ['size_sqm', 'Double', '≥ 0', 'Farm size in square metres.'], ['status', 'String', "DEFAULT 'active'", 'active, inactive or maintenance.']]],
  ['Cultivation Rooms', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier of the room.'], ['farm_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Farm the room belongs to.'], ['code', 'String', 'NOT NULL', 'Room code.'], ['capacity_bags', 'Integer', '≥ 0', 'Maximum number of growing bags.'], ['variety_id', 'ObjectId', 'FOREIGN KEY', 'Main variety grown in the room.'], ['temperature / humidity', 'Double', 'NOT NULL', 'Current room conditions.'], ['ventilation', 'String', "DEFAULT 'auto'", 'on, off or auto.']]],
  ['Mushroom Varieties', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier of the variety.'], ['org_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Owning organisation.'], ['name / scientific_name', 'String', 'NOT NULL', 'Common and scientific names.'], ['incubation_days, fruiting_days', 'Integer', '≥ 1', 'Expected durations.'], ['expected_yield_kg_per_bag', 'Double', '> 0', 'Expected yield per growing bag.'], ['temp_min/max, humidity_min/max', 'Double', 'NOT NULL', 'Recommended environmental range.'], ['price_per_kg', 'Double', '≥ 0', 'Default selling price.']]],
  ['Production Batches', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['code', 'String', 'NOT NULL, UNIQUE', 'Batch code, e.g. MB-2026-0012.'], ['farm_id, room_id, variety_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Farm, room and variety of the batch.'], ['substrate_type', 'String', 'NOT NULL', 'Substrate used.'], ['substrate_prep_date, spawning_date', 'Date', 'NOT NULL', 'Key production dates.'], ['bags', 'Integer', '≥ 1', 'Number of growing bags.'], ['stage', 'String', 'NOT NULL', 'Current lifecycle stage.'], ['expected_incubation_end, expected_first_harvest', 'Date', 'Calculated', 'Derived from the variety.'], ['expected_yield_kg / harvested_kg / rejected_kg', 'Double', 'Calculated', 'Expected and actual yield, and losses.']]],
  ['Stage History', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['batch_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Batch concerned.'], ['from / to', 'String', 'NOT NULL', 'Previous and new stage.'], ['at', 'DateTime', 'NOT NULL', 'Date and time of the transition.'], ['by / notes', 'String', '', 'User responsible and comments.']]],
  ['Growth Observations', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['batch_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Observed batch.'], ['date', 'Date', 'NOT NULL', 'Observation date.'], ['temperature / humidity', 'Double', 'NOT NULL', 'Measured conditions.'], ['condition', 'String', 'NOT NULL', 'excellent, good, fair or poor.'], ['contamination', 'Boolean', 'DEFAULT false', 'Whether contamination was observed.'], ['affected_bags', 'Integer', '≥ 0', 'Number of contaminated bags.']]],
  ['Harvests', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['code', 'String', 'NOT NULL, UNIQUE', 'Harvest code, e.g. HV-00041.'], ['batch_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Harvested batch.'], ['flush', 'Integer', '1–10, unique per batch', 'Harvest cycle number.'], ['bags_harvested', 'Integer', '≥ 1', 'Bags harvested.'], ['weight_kg / rejected_kg', 'Double', '> 0 / ≥ 0', 'Accepted and rejected weight.'], ['grade', 'String', 'A, B or C', 'Quality grade.'], ['status', 'String', "DEFAULT 'pending'", 'pending, approved or rejected.']]],
  ['Stock Lots', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['harvest_id', 'ObjectId', 'FOREIGN KEY', 'Approved harvest that created the lot.'], ['variety_id, farm_id', 'ObjectId', 'FOREIGN KEY', 'Variety and farm.'], ['quantity_kg / available_kg', 'Double', 'available_kg ≥ 0', 'Initial and remaining quantity.'], ['harvest_date / expiry_date', 'Date', 'NOT NULL', 'Freshness tracking.'], ['location', 'String', '', 'Storage location (e.g. cold room).']]],
  ['Inventory Items', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['farm_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Farm.'], ['name / sku', 'String', 'NOT NULL', 'Item name and stock code.'], ['category', 'String', 'NOT NULL', 'substrate, spawn, bags, packaging, cleaning or other.'], ['quantity / min_level', 'Double', '≥ 0', 'Current quantity and alert threshold.'], ['unit / unit_cost', 'String / Double', '', 'Unit of measure and cost.']]],
  ['Customers', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['org_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Owning organisation.'], ['name', 'String', 'NOT NULL', 'Customer name.'], ['type', 'String', 'NOT NULL', 'individual, retailer, wholesaler, restaurant or distributor.'], ['phone / email / address', 'String', '', 'Contact details.'], ['status', 'String', "DEFAULT 'active'", 'active or inactive.']]],
  ['Sales', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['number', 'String', 'NOT NULL, UNIQUE', 'Order number, e.g. SO-2026-00112.'], ['customer_id, farm_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Customer and selling farm.'], ['items[]', 'Embedded', 'at least one', 'Variety, grade, quantity, unit price, line total and stock allocations.'], ['subtotal / discount / total', 'Double', '≥ 0', 'Order amounts.'], ['paid / balance', 'Double', '≥ 0', 'Amount paid and outstanding.'], ['payment_status / delivery_status / status', 'String', '', 'Payment, delivery and order status.'], ['payments[]', 'Embedded', '', 'Payment history.']]],
  ['Expenses', [['_id', 'ObjectId', 'PRIMARY KEY', 'Unique identifier.'], ['farm_id', 'ObjectId', 'NOT NULL, FOREIGN KEY', 'Farm.'], ['batch_id', 'ObjectId', 'FOREIGN KEY (optional)', 'Related production batch.'], ['description / category', 'String', 'NOT NULL', 'Expense details and category.'], ['amount', 'Double', '> 0', 'Amount in RWF.'], ['date / payment_method', 'Date / String', 'NOT NULL', 'When and how it was paid.']]],
]
DD.forEach(([name, rows]) => {
  push(new Paragraph({ children: [new TextRun({ text: name, bold: true })], keepNext: true, spacing: { before: 160 } }))
  table(`Data Dictionary of the ${name} Entity`, ['Field Name', 'Data Type', 'Constraints', 'Description'], rows, [2500, 1300, 2000, 2866])
})
P('Other collections (employees, tasks, inventory_transactions, notifications, audit_logs and token_blocklist) follow the same conventions and are shown in the database diagram.')
H2('3.5 System Architectural Design')
P(`The system follows a three-tier client–server architecture. The **presentation layer** is a single-page React application running in the browser. It communicates over HTTPS with the **application layer**, a Flask REST API that handles authentication, permissions, tenant isolation, validation and business rules. The API reads and writes data in the **data layer**, a MongoDB database, using indexes and aggregation pipelines for reporting. This separation allows each layer to be developed, scaled and maintained independently.`)
landscape(() => figure('fig10_architecture.png', 'System Architecture of the Mushroom Farm Management System', { title: 'System Architectural Design of the Mushroom Farm Management System' }))

// ================================================================= CHAPTER 4
H1('CHAPTER 4: IMPLEMENTATION AND TESTING OF THE NEW SYSTEM')
H2('4.1 Introduction')
P('This chapter describes how the designed system was implemented and tested. It presents the technologies and tools used, the implementation process, the main screens of the new system and the testing carried out to verify that the system meets its requirements.')
H2('4.2 Technologies and Tools Used')
H3('4.2.1 Front-End Development')
B(['**React 19 with TypeScript and Vite:** component-based user interface with static typing and a fast development server and build.',
  '**Tailwind CSS v4 and shadcn/ui (Radix UI):** consistent, accessible and responsive components with light and dark themes.',
  '**TanStack Query and Axios:** data fetching, caching and automatic refresh of the access token.',
  '**React Hook Form and Zod:** form handling and client-side validation.', '**Zustand:** global state for the session, selected farm and theme.',
  '**Recharts, Lucide React and Framer Motion:** charts, icons and subtle animations.', '**React Router:** client-side navigation and protected routes.'])
H3('4.2.2 Back-End Development')
B(['**Python 3.12 and Flask 3:** modular REST API organised into blueprints (auth, organizations, users, farms, production, harvests, inventory, sales, dashboard, reports, notifications).',
  '**Flask-JWT-Extended:** JSON Web Token authentication with access tokens and rotating refresh tokens stored in a revocation list.',
  '**Pydantic:** validation of every request payload, with field-level error messages.', '**Werkzeug:** secure password hashing.',
  '**Flask-CORS and python-dotenv:** cross-origin configuration and environment-based secrets.'])
H3('4.2.3 Database')
B(['**MongoDB with PyMongo:** document database with indexes, unique constraints and aggregation pipelines for dashboards and reports.'])
H3('4.2.4 Development and Testing Tools')
B(['**Visual Studio Code** as the code editor and **Git** for version control.', '**Playwright** (headless Chromium) for automated end-to-end browser tests and screenshots.',
  '**Python test scripts and curl** for automated API scenario tests.', '[Add any other tools used, e.g. Figma, Postman, GitHub.]'])
H2('4.3 Implementation Process')
H3('4.3.1 Database Setup')
B(['Collections were created for organisations, users, farms, rooms, varieties, batches, stage history, observations, harvests, stock lots, inventory, customers, sales, expenses, employees, tasks, notifications and audit logs.',
  'Indexes and unique constraints (e.g. e-mail, batch code, harvest code, order number, farm code per organisation) are created automatically when the API starts.',
  'A seed script loads realistic demonstration data for two organisations to support demonstrations and testing.'])
H3('4.3.2 Back-End Development')
B(['A generic, reusable CRUD component provides pagination, search, sorting, filtering, validation, soft deletion and audit logging for most resources.',
  'Permission decorators enforce roles on every endpoint, and scoping helpers restrict every query to the user’s organisation and farms.',
  'Critical operations are protected against inconsistencies: a harvest can only be approved once (atomic status transition), and stock is deducted with guarded atomic updates so it can never become negative; if an order cannot be fully served, any stock already taken is released.',
  'Business rules include forward-only stage transitions, harvests only for batches in fruiting or harvesting, unique flush numbers per batch and automatic expected dates and yields.'])
H3('4.3.3 Front-End Development')
B(['Features are organised by module (landing, auth, dashboard, farms, production, harvests, inventory, sales, finance, team, reports, organisations).',
  'Reusable components include a data table with server-side search, sorting, filtering and pagination, configuration-driven form dialogs, KPI cards, charts, status badges, empty states and confirmation dialogs.',
  'The interface is responsive, supports light and dark themes and prints invoices and reports without the navigation.'])
H3('4.3.4 Integration and Deployment')
B(['The frontend communicates with the API through a single HTTP client that attaches the access token and the selected farm, and refreshes expired tokens automatically.',
  'Configuration and secrets (database connection, JWT secret, super-admin credentials, allowed origins) are read from environment variables.',
  '[Describe the deployment environment, e.g. the hosting provider for the frontend, the API server and the managed MongoDB database.]'])
H2('4.4 Presentation of the New System')
P('This section presents the main screens of the new system.')
const shots = [
  ['01-landing.jpg', 'Welcome Screen (Landing Page)', 'The public landing page introduces the platform, its features and the production lifecycle, and gives access to registration and login.'],
  ['02-landing-features.jpg', 'Platform Features Section', 'The landing page lists the eight main capabilities of the platform.'],
  ['04-register.jpg', 'Create Account Screen', 'A farm owner creates an account; this automatically creates a new, isolated organisation and farm.'],
  ['05-login.jpg', 'Login Screen', 'Users sign in with their e-mail and password. A theme switch is available on all authentication pages.'],
  ['06-demo-accounts.jpg', 'Demo Accounts Drawer', 'In demonstration mode, a drawer lists demo accounts by organisation and fills in the login form.'],
  ['10-dashboard.jpg', 'Farm Owner Dashboard', 'The dashboard shows the eight key indicators and charts for production, harvest performance, sales, stage distribution, variety distribution and monthly performance.'],
  ['11-dashboard-lists.jpg', 'Dashboard Alerts and Activity', 'Upcoming harvests, batches requiring attention, low-stock alerts, recent sales and recent activity.'],
  ['09-organizations.jpg', 'Super Admin – Organizations Console', 'The super admin manages tenants, sees their statistics, and can create, suspend or reactivate organisations.'],
  ['12-farms.jpg', 'Farms Management Screen', 'Farms with their code, location, size, rooms, active batches, manager and status.'],
  ['13-rooms.jpg', 'Cultivation Rooms Screen', 'Rooms with current temperature, humidity, ventilation and occupancy.'],
  ['14-varieties.jpg', 'Mushroom Varieties Screen', 'Varieties with growing cycle, expected yield, recommended conditions and price.'],
  ['15-production.jpg', 'Production Batches Screen', 'Batches by stage, with expected first harvest, yield progress and alert flags.'],
  ['16-new-batch.jpg', 'Create Production Batch Form', 'A manager creates a batch; expected dates and yield are computed from the variety.'],
  ['17-batch-detail.jpg', 'Production Batch Details', 'The lifecycle stepper, batch indicators, details, growth history, harvests and stage history.'],
  ['17b-observation.jpg', 'Record Growth Observation', 'Workers record conditions and contamination; out-of-range values trigger alerts.'],
  ['18-harvests-pending.jpg', 'Harvests Awaiting Approval', 'Monthly harvest chart, yield by variety and the list of harvests pending approval.'],
  ['19-approve-harvest.jpg', 'Approve Harvest Dialog', 'Approving a harvest adds it to stock with a storage location and shelf life.'],
  ['20-inventory.jpg', 'Inventory – Fresh Mushroom Stock', 'Stock by variety and lots with grade, expiry and available quantity.'],
  ['21-sales.jpg', 'Sales Orders Screen', 'Orders with totals, balances, payment and delivery status.'],
  ['21b-new-order.jpg', 'New Sales Order Form', 'A multi-product order with available stock, automatic pricing and totals.'],
  ['23-invoice.jpg', 'Invoice / Receipt Screen', 'A printable invoice with payment history, delivery and payment actions.'],
  ['22-customers.jpg', 'Customers Screen', 'Customers with type, contact, total spent and outstanding balance.'],
  ['24-expenses.jpg', 'Expenses Screen', 'Expenses with revenue, expenses, profit and cost-per-kilogram summary.'],
  ['25-reports.jpg', 'Reports Screen', 'Production, harvest, sales, financial and inventory reports with date filters, CSV export and print.'],
  ['27-tasks.jpg', 'Tasks Screen', 'Tasks with assignee, due date, priority and status.'],
  ['28-users.jpg', 'Users and Access Screen', 'Users of the organisation with their roles and farm access.'],
  ['29-notifications.jpg', 'Notifications Screen', 'Alerts about approvals, contamination, environment, low stock, sales and payments.'],
  ['30-dark-dashboard.jpg', 'Dashboard in Dark Mode', 'The application supports light and dark themes.'],
]
shots.forEach(([f, t, d]) => {
  push(new Paragraph({ children: [new TextRun({ text: t, bold: true })], keepNext: true, spacing: { before: 200 } }))
  P(d)
  figure(f, t, { maxH: 420 })
})
push(new Paragraph({ children: [new TextRun({ text: 'Mobile View', bold: true })], keepNext: true, spacing: { before: 200 } }))
P('The interface adapts to small screens; the navigation collapses into a menu and content is stacked vertically.')
figure('31-mobile-dashboard.jpg', 'Mobile View – Dashboard', { maxH: 430 })
figure('32-mobile-production.jpg', 'Mobile View – Production Batches', { maxH: 430 })

H2('4.5 Software Testing')
P('Software testing evaluates whether the system behaves as specified and meets the needs of its users. Testing in this project had two goals: verification (each module is built according to its specification) and validation (the complete system satisfies the needs of mushroom farm users). The following types of testing were performed.')
H3('4.5.1 Unit Testing')
P('Unit testing verified the smallest components in isolation. Request payloads are validated by Pydantic schemas on the server and Zod schemas on the client, and each rule (required fields, ranges, formats, cross-field checks such as spawning date after substrate preparation) was exercised with valid and invalid inputs. Core functions such as password hashing, token generation, the calculation of expected dates and yields, and the stock-allocation function were checked individually. [If a formal unit test suite (e.g. pytest, Vitest) is added, describe it here.]')
H3('4.5.2 Integration Testing')
P(`Integration testing checked that modules work correctly together through the REST API and the database, using automated Python scenario scripts that call the API as different users. Table ${tabNo + 1} summarises the main test cases and their results.`)
const tests = [
  ['TC01', 'Login with valid and invalid credentials', 'Valid: tokens returned; invalid: error message', 'As expected', 'Pass'],
  ['TC02', 'Farm worker attempts to create a farm', '403 Forbidden', '403 Forbidden', 'Pass'],
  ['TC03', 'Create batch, then move its stage backwards', 'Batch created; backward move rejected (400)', 'As expected', 'Pass'],
  ['TC04', 'Record harvest on a batch still in incubation', 'Rejected (422)', 'Rejected (422)', 'Pass'],
  ['TC05', 'Observation with contamination and high temperature', 'Saved; contamination and environment alerts created', 'As expected', 'Pass'],
  ['TC06', 'Worker tries to approve a harvest', '403 Forbidden', '403 Forbidden', 'Pass'],
  ['TC07', 'Manager approves the same harvest twice', 'First approval succeeds; second rejected (409); stock added once', 'As expected', 'Pass'],
  ['TC08', 'Sale of 25 kg with discount and partial payment', 'Order created; stock reduced by 25 kg; status partial', 'As expected', 'Pass'],
  ['TC09', 'Sale larger than available stock', 'Rejected (409); no stock deducted', 'As expected', 'Pass'],
  ['TC10', 'Pay remaining balance, then cancel the order', 'Status paid; on cancel stock restored', 'As expected', 'Pass'],
  ['TC11', 'Reuse of a refresh token after rotation', 'Second use rejected (401)', 'Rejected (401)', 'Pass'],
  ['TC12', 'Organisation B reads / edits organisation A’s customer', '404 Not found', '404 Not found', 'Pass'],
  ['TC13', 'Organisation A uses organisation B’s variety or customer', 'Rejected (422)', 'Rejected (422)', 'Pass'],
  ['TC14', 'Owner adds a user to another organisation’s farm', '403 Forbidden', '403 Forbidden', 'Pass'],
  ['TC15', 'New self-registration', 'New empty organisation with starter varieties', 'As expected', 'Pass'],
  ['TC16', 'Super admin suspends an organisation', 'Its users blocked immediately (403), login refused', 'As expected', 'Pass'],
]
table('Integration and Security Test Cases', ['ID', 'Test case', 'Expected result', 'Actual result', 'Status'], tests, [700, 3000, 2766, 1400, 800])
P('In total, 27 automated tenant-isolation checks and the production-to-sales workflow scenario were executed against the running API, and all passed.')
H3('4.5.3 Validation and End-to-End Testing')
P('End-to-end tests were run in a real browser (headless Chromium driven by Playwright) to validate complete user journeys through the interface:')
B(['A farm worker opens a fruiting batch and records a harvest; the system confirms it was submitted for approval.',
  'A farm manager opens the pending harvests and approves one; the harvest is added to stock.',
  'A sales manager creates a sales order through the form; the unit price is filled from the variety and the order and invoice are created.',
  'An order larger than the available stock is rejected with a clear message.',
  'The layout was checked on desktop and mobile screen sizes and in light and dark themes.'])
P('[Describe user acceptance testing with the staff of the case study farm, if conducted, and summarise their feedback.]')
H2('4.6 Hardware and Software Requirements')
H3('4.6.1 Client-Side Requirements')
B(['**Operating system:** Windows, macOS, Linux, Android or iOS.', '**Web browser:** a recent version of Google Chrome, Mozilla Firefox, Microsoft Edge or Safari.',
  '**Processor and memory:** any device able to run a modern browser (2 GB RAM or more recommended).', '**Network:** an internet connection to reach the server.'])
H3('4.6.2 Server-Side Requirements')
B(['**Operating system:** Ubuntu 22.04 LTS or later (or any OS supporting Python and MongoDB).', '**Runtime:** Python 3.11+ for the API; Node.js 20+ to build the frontend.',
  '**Database:** MongoDB 6 or later (local or managed).', '**Web server:** Nginx or a platform service providing HTTPS and serving the built frontend.',
  '**Hardware:** at least 2 CPU cores, 4 GB RAM and 20 GB SSD storage (more for larger deployments).'])

// ================================================================= CHAPTER 5
H1('CHAPTER 5: CONCLUSION AND RECOMMENDATIONS')
H2('5.1 Conclusion')
P(`This project set out to address the problems caused by manual management of mushroom farms: poor traceability of production batches, late detection of contamination, unconsolidated harvests, inaccurate stock, untracked payments and the lack of reliable financial information. To solve them, **${SYS}** was designed and implemented as a secure, multi-tenant web application.`)
P('The system meets the objectives of the study. It manages organisations, users and roles; farms, rooms and varieties; production batches through the eight lifecycle stages with a full history; growth observations with automatic alerts; harvests per flush with an approval workflow; inventory that updates automatically from harvests and sales; customers, orders, payments and invoices; expenses and profit; staff and tasks; and dashboards, reports and notifications. Testing confirmed that the main workflows work correctly, that critical operations such as harvest approval and stock deduction remain consistent, and that each organisation’s data is isolated from the others.')
P('From a technical point of view, the combination of a React and TypeScript frontend, a Flask REST API and a MongoDB database produced a responsive, maintainable and scalable solution. The modular design allows the system to be extended to new features and to serve many farms and cooperatives on the same platform.')
H2('5.2 Recommendations')
H3(`5.2.1 To ${CASE}`)
B(['Train all staff on the roles that concern them (recording observations and harvests, approving harvests, managing sales) before full adoption.',
  'Record observations and harvests daily so that alerts, stock and reports remain accurate.', 'Regularly back up the database and review user access when staff change.'])
H3('5.2.2 To the Catholic University of Rwanda')
B(['Encourage more student projects that apply ICT to agriculture and agribusiness.', 'Support partnerships with farms and cooperatives so that student solutions can be piloted in real conditions.'])
H3('5.2.3 To Future Researchers and Developers')
B(['Integrate IoT sensors to capture temperature and humidity automatically.', 'Add e-mail and SMS notifications and mobile-money payment integration.',
  'Develop a mobile application with offline support for workers in grow rooms.', 'Add native PDF and Excel report generation and a formal automated unit-test suite.',
  'Use the accumulated data for yield prediction and production planning.'])
H2('5.3 Limitations of the Study')
B(['Password reset and e-mail verification currently display the link on screen instead of sending an e-mail.',
  'Reports are exported as CSV and printed to PDF from the browser; native Excel/PDF generation is not yet implemented.',
  'Photo upload for growth observations and rate limiting are not yet implemented.', '[Add any other limitations, e.g. the duration of the pilot at the case study farm.]'])

// ================================================================= REFERENCES
H1('REFERENCES')
H2('Books')
for (const r of [
  'Chang, S. T., & Miles, P. G. (2004). Mushrooms: Cultivation, Nutritional Value, Medicinal Effect, and Environmental Impact (2nd ed.). CRC Press.',
  'Elmasri, R., & Navathe, S. B. (2016). Fundamentals of Database Systems (7th ed.). Pearson.',
  'Fowler, M. (2003). Patterns of Enterprise Application Architecture. Addison-Wesley.',
  'Kendall, K. E., & Kendall, J. E. (2019). Systems Analysis and Design (10th ed.). Pearson.',
  'Myers, G. J., Sandler, C., & Badgett, T. (2011). The Art of Software Testing (3rd ed.). Wiley.',
  'Pressman, R. S., & Maxim, B. R. (2020). Software Engineering: A Practitioner’s Approach (9th ed.). McGraw-Hill Education.',
  'Sommerville, I. (2016). Software Engineering (10th ed.). Pearson Education.',
  'Stamets, P. (2000). Growing Gourmet and Medicinal Mushrooms (3rd ed.). Ten Speed Press.',
]) push(new Paragraph({ children: [new TextRun(r)], indent: { left: 720, hanging: 720 } }))
H2('Websites')
for (const r of [
  'Flask. (2024). Flask Documentation. https://flask.palletsprojects.com',
  'MongoDB. (2024). MongoDB Manual. https://www.mongodb.com/docs/manual/',
  'React. (2024). React Documentation. https://react.dev',
  'Tailwind CSS. (2024). Tailwind CSS Documentation. https://tailwindcss.com/docs',
  'shadcn/ui. (2024). shadcn/ui Components. https://ui.shadcn.com',
  'TanStack. (2024). TanStack Query Documentation. https://tanstack.com/query',
  'Jones, M., Bradley, J., & Sakimura, N. (2015). JSON Web Token (JWT), RFC 7519. IETF. https://www.rfc-editor.org/rfc/rfc7519',
  'OWASP Foundation. (2021). OWASP Top 10. https://owasp.org/Top10/',
  'Object Management Group. (2017). Unified Modeling Language Specification, Version 2.5.1. https://www.omg.org/spec/UML/',
]) push(new Paragraph({ children: [new TextRun(r)], indent: { left: 720, hanging: 720 } }))

// ================================================================= APPENDICES
H1('APPENDICES')
H2('Appendix A: Summary of the REST API')
table('Summary of the Main API Endpoints', ['Module', 'Endpoints (prefix /api/v1)'], [
  ['Authentication', 'POST auth/register, auth/login, auth/refresh, auth/logout, auth/forgot-password, auth/reset-password, auth/verify-email; GET/PUT auth/me'],
  ['Organizations', 'GET/POST organizations; PATCH organizations/{id} (Super Admin)'], ['Users', 'GET/POST users; PUT/DELETE users/{id}'],
  ['Farms & rooms', 'GET/POST farms, rooms, varieties, employees, tasks; GET/PUT/DELETE …/{id}'],
  ['Production', 'GET/POST production/batches; GET/PUT/DELETE production/batches/{id}; PATCH …/{id}/stage; POST …/{id}/observations'],
  ['Harvests', 'GET/POST harvests; PATCH harvests/{id}/approve; GET harvests/reports'],
  ['Inventory', 'GET/POST inventory/items; GET inventory/stock, inventory/stock/summary, inventory/low-stock; GET/POST inventory/transactions'],
  ['Sales', 'GET/POST sales; GET sales/{id}; PATCH sales/{id}/status; POST sales/{id}/payments; GET/POST customers'],
  ['Finance & reports', 'GET/POST expenses; GET reports/{production|harvest|sales|financial|inventory}'],
  ['Dashboard & notifications', 'GET dashboard/overview; GET notifications; PATCH notifications/{id}/read; POST notifications/read-all'],
], [2200, 6466])
H2('Appendix B: Interview Guide')
N(['How are production batches currently identified and recorded?', 'How often are temperature, humidity and contamination checked, and where are they written?',
  'How are harvests weighed, graded and recorded? Are rejected mushrooms recorded?', 'How do you know the quantity of fresh mushrooms available for sale?',
  'How are orders, payments and customer debts recorded?', 'Which reports or figures would help you make better decisions?'])
H2('Appendix C: Installation Guide')
N(['Install Python 3.11+, Node.js 20+ and MongoDB.', 'Backend: create a virtual environment, install requirements.txt, copy .env.example to .env and set the secrets and super-admin credentials, then run python seed.py (optional demo data) and python run.py.',
  'Frontend: run npm install, then npm run dev for development or npm run build to produce the production files.', 'Open the application in a browser and sign in.'])

// ================================================================= assemble document
const footer = () => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }) })
const pagePortrait = { size: { width: A4.width, height: A4.height }, margin: MARGIN }
const pageLandscape = { size: { width: A4.width, height: A4.height, orientation: PageOrientation.LANDSCAPE }, margin: MARGIN }

const cover = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'CATHOLIC UNIVERSITY OF RWANDA', bold: true, size: 32 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: runs(FAC, { bold: true }) }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: runs(DEPT, { bold: true }) }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: runs('[University Logo]') }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'MUSHROOM FARM MANAGEMENT SYSTEM', bold: true, size: 32 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: '(MycoFarm)', bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: runs(`Case Study: ${CASE}`, { size: 26 }) }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: runs('A Final Year Project Presented in partial fulfilment of the requirements for the award of the degree of') }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: runs(PROG.toUpperCase(), { bold: true }) }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: runs(`Major in ${MAJOR}`) }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('By')] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: STUDENT, bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: runs(`Reg. No: ${REG}`) }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: runs(`Supervisor: ${SUP}`) }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: runs(DATE, { bold: true }) }),
]

const sections = [
  { properties: { page: pagePortrait }, children: cover },
  { properties: { page: { ...pagePortrait, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } }, footers: footer(), children: front },
]
blocks.forEach((b, i) => {
  const page = b.orient === 'L' ? pageLandscape : pagePortrait
  const props = { page: i === 0 ? { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } : page }
  // a landscape block always starts on a new page; strip a leading page break from the following portrait heading
  sections.push({ properties: props, footers: footer(), children: b.items })
})

const doc = new Document({
  creator: STUDENT, title: SYS, description: 'Final year project report',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: 360, after: 120 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, allCaps: false }, paragraph: { spacing: { before: 240, after: 240 }, keepNext: true, outlineLevel: 0, alignment: AlignmentType.CENTER } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, italics: true }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 2 } },
      { id: 'FigureCaption', name: 'Figure Caption', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 20, italics: true, color: '2F4F3F' }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 } } },
      { id: 'TableCaption', name: 'Table Caption', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 20, italics: true, color: '2F4F3F' }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 80, after: 240 } } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections,
})

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf)
  console.log('written', OUT, (buf.length / 1024 / 1024).toFixed(1) + ' MB', `${figNo} figures, ${tabNo} tables, ${sections.length} sections`)
})
