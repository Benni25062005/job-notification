// Ausschließlich erfundene Beispieldaten. Nur nach Klick auf „Demo ansehen“ geladen.
const examples = [
  { title: 'Junior Frontend Developer · React', company: 'Studio Nordlicht (Demo)', location: 'Dornbirn, Vorarlberg', country: 'at', score: 95, category: 'Sehr passend', description: 'Entwickle moderne Weboberflächen mit React und TypeScript. Ein kleines Team, gemeinsame Code-Reviews und Raum, um als Berufseinsteiger zu wachsen.', reasons: ['Standort im bevorzugten Unterland/Rheintal.', 'Junior oder Berufseinstieg ausdrücklich erwähnt.', 'Passende Technologien: React, TypeScript, HTML, CSS.'], isNew: true },
  { title: 'Junior Softwareentwickler · C# / .NET', company: 'Rheintal Digital (Demo)', location: 'Hohenems, Vorarlberg', country: 'at', score: 90, category: 'Sehr passend', description: 'Arbeite an Geschäftsanwendungen und Schnittstellen. Du bringst erste Programmiererfahrung mit, wir begleiten dich bei den nächsten Schritten.', reasons: ['Standort im bevorzugten Unterland/Rheintal.', 'Junior oder Berufseinstieg ausdrücklich erwähnt.', 'Passende Technologien: C#, .NET, SQL.'], isNew: true },
  { title: 'Fullstack Webentwickler · PHP & React', company: 'Seewerk Software (Demo)', location: 'Lindau, Bayern', country: 'de', score: 74, category: 'Potenziell passend', description: 'Gestalte Webanwendungen vom Datenmodell bis zur Oberfläche. Erste Berufserfahrung ist erwünscht; persönliche Projekte sind ebenfalls interessant.', reasons: ['Standort innerhalb der erweiterten Wunschregion.', 'Mehrjährige Erfahrung erwähnt; Bewerbung kann trotzdem sinnvoll sein.', 'Passende Technologien: PHP, React, MySQL.'], isNew: true },
  { title: 'Software Developer · Webanwendungen', company: 'Wiesenweg Systems (Demo)', location: 'Ravensburg, Baden-Württemberg', country: 'de', score: 65, category: 'Potenziell passend', description: 'Entwickle interne Werkzeuge und digitale Produkte gemeinsam mit einem interdisziplinären Team. Gute Grundlagen in JavaScript und SQL helfen beim Einstieg.', reasons: ['Standort innerhalb der erweiterten Wunschregion.', 'Berufseinstieg im verfügbaren Text nicht ausdrücklich bestätigt.', 'Passende Technologien: JavaScript, SQL.'], isNew: false },
  { title: 'Senior Backend Developer · Node.js', company: 'Bergkante Labs (Demo)', location: 'Bregenz, Vorarlberg', country: 'at', score: 44, category: 'Weniger passend', description: 'Übernimm Verantwortung für Backend-Architektur und API-Entwicklung. Gesucht wird ein erfahrener Entwickler für komplexe Anwendungen.', reasons: ['Standort im bevorzugten Unterland/Rheintal.', 'Senior-/Führungsrolle: deutlich mehr Erfahrung erwartet.', 'Passende Technologien: Node.js, TypeScript.'], isNew: false },
  { title: 'Webentwickler · Digitale Plattformen', company: 'Talblick IT (Demo)', location: 'Bludenz, Vorarlberg', country: 'at', score: 40, category: 'Weniger passend', description: 'Baue Webplattformen mit PHP und JavaScript. Die Aufgaben passen zur Webentwicklung, der Standort liegt jedoch außerhalb deiner bevorzugten Region.', reasons: ['Standort außerhalb der erkannten Wunschorte oder zu ungenau; Anfahrt prüfen.', 'Passende Technologien: PHP, JavaScript.'], isNew: false },
];

export function demoData() {
  const today = new Date();
  return {
    searchedAt: today.toISOString(), notificationsEnabled: false, warnings: [],
    email: { status: 'demo' },
    profile: { skills: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'PHP', 'C#', '.NET', 'SQL', 'MySQL', 'HTML', 'CSS', 'Tailwind', 'WordPress'] },
    jobs: examples.map((job, index) => ({ ...job, id: `demo-${index + 1}`, source: 'Demo', url: null,
      publishedAt: new Date(today.getTime() - index * 86400000).toISOString() })),
  };
}
