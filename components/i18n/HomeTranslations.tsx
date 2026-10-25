"use client";

import { useLanguage } from "./languageStore";

const messages = {
  es: {
    shortNotice: "No garantizamos ganancias. Irvin Analytics es una herramienta de análisis estadístico e informativo.",
    featuresIntro: "Toda la información importante del partido en una sola pantalla: estadísticas, IA, probabilidades, momentum y señales en vivo.",

    sectionTitle: "Diseñado para gente que quiere analizar mejor",
    sectionText: "Irvin Analytics no es una promesa de dinero fácil. Es una herramienta para analizar el fútbol con datos reales, modelos matemáticos e inteligencia artificial, ayudándote a tomar decisiones con más información y menos intuición.",
    plansIntro: "Elige tu acceso mensual y empieza a usar Irvin Analytics.",
    betaDesc: "Acceso básico para probar la plataforma.",
    premiumDesc: "TV en vivo, informes e IA avanzada.",
    vipDesc: "Acceso completo a todas las funciones premium.",
    activate: "ACTIVAR",
    popular: "MÁS POPULAR",
    disclaimer: "Aviso responsable: Irvin Analytics ofrece análisis estadístico y deportivo. Las predicciones no garantizan resultados. El uso de la información es responsabilidad del usuario.",

    cards: [{"title": "TV EN VIVO", "text": "Pantalla profesional para seguir partidos en directo con datos, eventos y probabilidades."}, {"title": "IA PREDICTIVA", "text": "Modelo Poisson, Próximo Gol, BTTS, Over/Under, marcador probable y análisis inteligente."}, {"title": "MATCH MOMENTUM", "text": "Lectura del dominio del partido para detectar qué equipo está generando más peligro."}, {"title": "INFORMES PREMIUM", "text": "Informes diarios con partidos destacados, probabilidades y análisis estadístico."}, {"title": "DATOS EN TIEMPO REAL", "text": "Actualización constante de estadísticas, goles, tiros, corners, tarjetas y eventos."}, {"title": "ACCESO PRIVADO", "text": "Sistema protegido con usuarios, planes, licencias y control de acceso."}],
        heroDescription: "Plataforma privada de análisis deportivo con inteligencia artificial. Analiza partidos en vivo, detecta momentum, calcula probabilidades y genera informes premium para tomar mejores decisiones.",
badge: "IA DEPORTIVA EN TIEMPO REAL",
    demo: "VER DEMO EN VIVO",
    login: "ENTRAR AL SISTEMA",
    features: "¿Qué puedes analizar?",
    plans: "Planes"
  },
  en: {
    shortNotice: "We do not guarantee profits. Irvin Analytics is a statistical and informational analysis tool.",
    featuresIntro: "All the important match information on one screen: statistics, AI, probabilities, momentum and live signals.",

    sectionTitle: "Designed for people who want better analysis",
    sectionText: "Irvin Analytics is not a promise of easy money. It is a tool for analysing football using real data, mathematical models and artificial intelligence, helping you make more informed decisions with less guesswork.",
    plansIntro: "Choose your monthly plan and start using Irvin Analytics.",
    betaDesc: "Basic access to try the platform.",
    premiumDesc: "Live TV, reports and advanced AI.",
    vipDesc: "Full access to all premium features.",
    activate: "ACTIVATE",
    popular: "MOST POPULAR",
    disclaimer: "Responsible use notice: Irvin Analytics provides statistical and sports analysis. Predictions do not guarantee results. Users are responsible for how they use this information.",

    cards: [{"title": "LIVE TV", "text": "Professional live match coverage with data, events and probabilities."}, {"title": "PREDICTIVE AI", "text": "Poisson model, Next Goal, BTTS, Over/Under, predicted scores and intelligent analysis."}, {"title": "MATCH MOMENTUM", "text": "Track match dominance to identify which team is creating more danger."}, {"title": "PREMIUM REPORTS", "text": "Daily reports featuring selected matches, probabilities and statistical analysis."}, {"title": "REAL-TIME DATA", "text": "Continuous updates on statistics, goals, shots, corners, cards and events."}, {"title": "PRIVATE ACCESS", "text": "Protected platform with users, plans, licences and access control."}],
        heroDescription: "Private AI-powered sports analytics platform. Analyse live matches, track momentum, calculate probabilities and generate premium reports to make better-informed decisions.",
badge: "REAL-TIME SPORTS AI",
    demo: "VIEW LIVE DEMO",
    login: "SIGN IN",
    features: "What can you analyse?",
    plans: "Plans"
  },
  fr: {
    shortNotice: "Nous ne garantissons aucun gain. Irvin Analytics est un outil d'analyse statistique et d'information.",
    featuresIntro: "Toutes les informations importantes du match sur un seul écran : statistiques, IA, probabilités, dynamique et signaux en direct.",

    sectionTitle: "Conçu pour ceux qui souhaitent mieux analyser",
    sectionText: "Irvin Analytics ne promet pas de gains faciles. C'est un outil d'analyse du football fondé sur des données réelles, des modèles mathématiques et l'intelligence artificielle, pour prendre des décisions mieux informées.",
    plansIntro: "Choisissez votre abonnement mensuel et commencez à utiliser Irvin Analytics.",
    betaDesc: "Accès de base pour essayer la plateforme.",
    premiumDesc: "TV en direct, rapports et IA avancée.",
    vipDesc: "Accès complet à toutes les fonctionnalités premium.",
    activate: "ACTIVER",
    popular: "LE PLUS POPULAIRE",
    disclaimer: "Avertissement : Irvin Analytics propose des analyses statistiques et sportives. Les prédictions ne garantissent aucun résultat. L'utilisateur est responsable de l'utilisation des informations.",

    cards: [{"title": "TV EN DIRECT", "text": "Suivez les matchs en direct avec les données, événements et probabilités."}, {"title": "IA PRÉDICTIVE", "text": "Modèle de Poisson, prochain but, BTTS, Over/Under, scores probables et analyse intelligente."}, {"title": "DYNAMIQUE DU MATCH", "text": "Analysez la domination du match pour identifier l'équipe la plus dangereuse."}, {"title": "RAPPORTS PREMIUM", "text": "Rapports quotidiens avec matchs sélectionnés, probabilités et analyses statistiques."}, {"title": "DONNÉES EN TEMPS RÉEL", "text": "Mises à jour continues des statistiques, buts, tirs, corners, cartons et événements."}, {"title": "ACCÈS PRIVÉ", "text": "Plateforme protégée avec utilisateurs, abonnements, licences et contrôle d'accès."}],
        heroDescription: "Plateforme privée d'analyse sportive basée sur l'intelligence artificielle. Analysez les matchs en direct, suivez la dynamique, calculez les probabilités et générez des rapports premium pour prendre de meilleures décisions.",
badge: "IA SPORTIVE EN TEMPS RÉEL",
    demo: "VOIR LA DÉMO EN DIRECT",
    login: "SE CONNECTER",
    features: "Que pouvez-vous analyser ?",
    plans: "Abonnements"
  },
  de: {
    shortNotice: "Wir garantieren keine Gewinne. Irvin Analytics ist ein Tool für statistische Analysen und Informationen.",
    featuresIntro: "Alle wichtigen Spielinformationen auf einem Bildschirm: Statistiken, KI, Wahrscheinlichkeiten, Spieldynamik und Live-Signale.",

    sectionTitle: "Für alle, die fundierter analysieren möchten",
    sectionText: "Irvin Analytics verspricht kein leicht verdientes Geld. Die Plattform unterstützt die Fußballanalyse mit echten Daten, mathematischen Modellen und künstlicher Intelligenz, damit Sie fundiertere Entscheidungen treffen können.",
    plansIntro: "Wählen Sie Ihren Monatstarif und nutzen Sie Irvin Analytics.",
    betaDesc: "Basiszugang zum Testen der Plattform.",
    premiumDesc: "Live-TV, Berichte und fortschrittliche KI.",
    vipDesc: "Voller Zugriff auf alle Premium-Funktionen.",
    activate: "AKTIVIEREN",
    popular: "AM BELIEBTESTEN",
    disclaimer: "Hinweis: Irvin Analytics bietet statistische Sportanalysen. Prognosen garantieren keine Ergebnisse. Die Nutzung der Informationen liegt in der Verantwortung der Nutzer.",

    cards: [{"title": "LIVE-TV", "text": "Professionelle Live-Spielübersicht mit Daten, Ereignissen und Wahrscheinlichkeiten."}, {"title": "PRÄDIKTIVE KI", "text": "Poisson-Modell, nächstes Tor, BTTS, Over/Under, wahrscheinliche Ergebnisse und intelligente Analysen."}, {"title": "SPIELDYNAMIK", "text": "Analysieren Sie die Spielkontrolle und erkennen Sie, welches Team mehr Gefahr erzeugt."}, {"title": "PREMIUM-BERICHTE", "text": "Tägliche Berichte mit ausgewählten Spielen, Wahrscheinlichkeiten und statistischen Analysen."}, {"title": "ECHTZEITDATEN", "text": "Laufende Aktualisierung von Statistiken, Toren, Schüssen, Ecken, Karten und Ereignissen."}, {"title": "PRIVATER ZUGANG", "text": "Geschützte Plattform mit Benutzern, Tarifen, Lizenzen und Zugriffskontrolle."}],
        heroDescription: "Private Plattform für KI-gestützte Sportanalysen. Analysieren Sie Live-Spiele, verfolgen Sie die Spieldynamik, berechnen Sie Wahrscheinlichkeiten und erstellen Sie Premium-Berichte für fundiertere Entscheidungen.",
badge: "SPORT-KI IN ECHTZEIT",
    demo: "LIVE-DEMO ANSEHEN",
    login: "ANMELDEN",
    features: "Was können Sie analysieren?",
    plans: "Tarife"
  },
  it: {
    shortNotice: "Non garantiamo guadagni. Irvin Analytics è uno strumento di analisi statistica e informativa.",
    featuresIntro: "Tutte le informazioni importanti della partita in un'unica schermata: statistiche, IA, probabilità, andamento e segnali in diretta.",

    sectionTitle: "Pensato per chi vuole analizzare meglio",
    sectionText: "Irvin Analytics non promette guadagni facili. È uno strumento per analizzare il calcio attraverso dati reali, modelli matematici e intelligenza artificiale, aiutandoti a prendere decisioni più informate.",
    plansIntro: "Scegli il tuo piano mensile e inizia a utilizzare Irvin Analytics.",
    betaDesc: "Accesso base per provare la piattaforma.",
    premiumDesc: "TV in diretta, report e IA avanzata.",
    vipDesc: "Accesso completo a tutte le funzionalità premium.",
    activate: "ATTIVA",
    popular: "PIÙ POPOLARE",
    disclaimer: "Avviso: Irvin Analytics offre analisi statistiche e sportive. Le previsioni non garantiscono risultati. L'utilizzo delle informazioni è responsabilità dell'utente.",

    cards: [{"title": "TV IN DIRETTA", "text": "Segui le partite in diretta con dati, eventi e probabilità."}, {"title": "IA PREDITTIVA", "text": "Modello di Poisson, prossimo gol, BTTS, Over/Under, risultati probabili e analisi intelligente."}, {"title": "ANDAMENTO DELLA PARTITA", "text": "Analizza il dominio della partita per individuare la squadra più pericolosa."}, {"title": "REPORT PREMIUM", "text": "Report giornalieri con partite selezionate, probabilità e analisi statistiche."}, {"title": "DATI IN TEMPO REALE", "text": "Aggiornamenti continui di statistiche, gol, tiri, calci d'angolo, cartellini ed eventi."}, {"title": "ACCESSO PRIVATO", "text": "Piattaforma protetta con utenti, piani, licenze e controllo degli accessi."}],
        heroDescription: "Piattaforma privata di analisi sportiva basata sull'intelligenza artificiale. Analizza le partite in diretta, monitora l'andamento del gioco, calcola le probabilità e genera report premium per prendere decisioni più informate.",
badge: "IA SPORTIVA IN TEMPO REALE",
    demo: "GUARDA LA DEMO",
    login: "ACCEDI",
    features: "Cosa puoi analizzare?",
    plans: "Piani"
  },
  pt: {
    shortNotice: "Não garantimos ganhos. O Irvin Analytics é uma ferramenta de análise estatística e informativa.",
    featuresIntro: "Todas as informações importantes do jogo num único ecrã: estatísticas, IA, probabilidades, dinâmica e sinais em direto.",

    sectionTitle: "Criado para quem quer analisar melhor",
    sectionText: "O Irvin Analytics não promete dinheiro fácil. É uma ferramenta para analisar futebol com dados reais, modelos matemáticos e inteligência artificial, ajudando a tomar decisões mais informadas.",
    plansIntro: "Escolha o seu plano mensal e comece a utilizar o Irvin Analytics.",
    betaDesc: "Acesso básico para experimentar a plataforma.",
    premiumDesc: "TV em direto, relatórios e IA avançada.",
    vipDesc: "Acesso completo a todas as funcionalidades premium.",
    activate: "ATIVAR",
    popular: "MAIS POPULAR",
    disclaimer: "Aviso: O Irvin Analytics disponibiliza análises estatísticas e desportivas. As previsões não garantem resultados. A utilização das informações é da responsabilidade do utilizador.",

    cards: [{"title": "TV AO VIVO", "text": "Acompanhe jogos em direto com dados, eventos e probabilidades."}, {"title": "IA PREDITIVA", "text": "Modelo de Poisson, próximo golo, BTTS, Over/Under, resultados prováveis e análise inteligente."}, {"title": "DINÂMICA DO JOGO", "text": "Analise o domínio do jogo e identifique a equipa que cria mais perigo."}, {"title": "RELATÓRIOS PREMIUM", "text": "Relatórios diários com jogos selecionados, probabilidades e análises estatísticas."}, {"title": "DADOS EM TEMPO REAL", "text": "Atualizações contínuas de estatísticas, golos, remates, cantos, cartões e eventos."}, {"title": "ACESSO PRIVADO", "text": "Plataforma protegida com utilizadores, planos, licenças e controlo de acesso."}],
        heroDescription: "Plataforma privada de análise desportiva com inteligência artificial. Analise jogos ao vivo, acompanhe o ritmo da partida, calcule probabilidades e gere relatórios premium para tomar decisões mais informadas.",
badge: "IA DESPORTIVA EM TEMPO REAL",
    demo: "VER DEMONSTRAÇÃO",
    login: "ENTRAR",
    features: "O que pode analisar?",
    plans: "Planos"
  },
  ar: {
    shortNotice: "لا نضمن تحقيق أرباح. Irvin Analytics أداة للتحليل الإحصائي والمعلوماتي.",
    featuresIntro: "جميع معلومات المباراة المهمة في شاشة واحدة: الإحصائيات والذكاء الاصطناعي والاحتمالات وزخم المباراة والإشارات المباشرة.",

    sectionTitle: "مصمم لمن يريد تحليلاً أفضل",
    sectionText: "لا تعد منصة Irvin Analytics بتحقيق أرباح سهلة. إنها أداة لتحليل كرة القدم باستخدام بيانات حقيقية ونماذج رياضية وذكاء اصطناعي لمساعدتك على اتخاذ قرارات أكثر استنارة.",
    plansIntro: "اختر اشتراكك الشهري وابدأ باستخدام Irvin Analytics.",
    betaDesc: "وصول أساسي لتجربة المنصة.",
    premiumDesc: "بث مباشر وتقارير وذكاء اصطناعي متقدم.",
    vipDesc: "وصول كامل إلى جميع الميزات المميزة.",
    activate: "تفعيل",
    popular: "الأكثر شعبية",
    disclaimer: "تنبيه: تقدم Irvin Analytics تحليلات إحصائية ورياضية. التوقعات لا تضمن النتائج. يتحمل المستخدم مسؤولية استخدام المعلومات.",

    cards: [{"title": "البث المباشر", "text": "تابع المباريات مباشرة مع البيانات والأحداث والاحتمالات."}, {"title": "الذكاء الاصطناعي التنبؤي", "text": "نموذج بواسون، الهدف التالي، تسجيل الفريقين، أكثر أو أقل، النتائج المتوقعة والتحليل الذكي."}, {"title": "زخم المباراة", "text": "حلّل السيطرة على المباراة لمعرفة الفريق الذي يصنع فرصًا أكثر خطورة."}, {"title": "تقارير مميزة", "text": "تقارير يومية عن مباريات مختارة مع الاحتمالات والتحليل الإحصائي."}, {"title": "بيانات فورية", "text": "تحديثات مستمرة للإحصائيات والأهداف والتسديدات والركنيات والبطاقات والأحداث."}, {"title": "وصول خاص", "text": "منصة محمية بإدارة المستخدمين والخطط والتراخيص وصلاحيات الوصول."}],
        heroDescription: "منصة خاصة للتحليل الرياضي بالذكاء الاصطناعي. حلّل المباريات المباشرة، وتابع زخم اللعب، واحسب الاحتمالات، وأنشئ تقارير مميزة لاتخاذ قرارات أكثر استنارة.",
badge: "ذكاء اصطناعي رياضي مباشر",
    demo: "عرض تجريبي مباشر",
    login: "تسجيل الدخول",
    features: "ماذا يمكنك تحليل؟",
    plans: "الخطط"
  },
  ja: {
    shortNotice: "利益を保証するものではありません。Irvin Analyticsは統計分析と情報提供のためのツールです。",
    featuresIntro: "統計、AI、確率、試合の勢い、リアルタイムのシグナルなど、重要な試合情報を一画面で確認できます。",

    sectionTitle: "より深い分析を求める方のために",
    sectionText: "Irvin Analyticsは簡単に利益が得られることを約束するものではありません。実際のデータ、数学モデル、AIを活用してサッカーを分析し、勘に頼らず、より多くの情報に基づいた判断をサポートします。",
    plansIntro: "月額プランを選んでIrvin Analyticsを始めましょう。",
    betaDesc: "プラットフォームを試すための基本アクセス。",
    premiumDesc: "ライブTV、レポート、高度なAI。",
    vipDesc: "すべてのプレミアム機能を利用できます。",
    activate: "有効にする",
    popular: "一番人気",
    disclaimer: "ご注意：Irvin Analyticsはスポーツ統計分析を提供します。予測は結果を保証するものではありません。情報の利用はユーザー自身の責任となります。",

    cards: [{"title": "ライブTV", "text": "試合データ、イベント、確率を確認しながらリアルタイムで観戦できます。"}, {"title": "予測AI", "text": "ポアソンモデル、次のゴール、両チーム得点、オーバー・アンダー、予想スコアと高度な分析。"}, {"title": "試合の勢い", "text": "試合の主導権を分析し、どちらのチームがより多くのチャンスを生み出しているかを把握します。"}, {"title": "プレミアムレポート", "text": "注目試合、確率、統計分析をまとめた日次レポート。"}, {"title": "リアルタイムデータ", "text": "統計、ゴール、シュート、コーナーキック、カード、試合イベントを継続的に更新します。"}, {"title": "プライベートアクセス", "text": "ユーザー、プラン、ライセンス、アクセス権限を管理する安全なプラットフォーム。"}],
        heroDescription: "AIを活用したスポーツ分析プラットフォーム。試合をリアルタイムで分析し、試合の流れを把握し、確率を算出して詳細なレポートを生成することで、より的確な判断をサポートします。",
badge: "リアルタイムスポーツAI",
    demo: "ライブデモを見る",
    login: "ログイン",
    features: "どのような分析ができますか？",
    plans: "料金プラン"
  },
  zh: {
    shortNotice: "我们不保证盈利。Irvin Analytics 是一款统计分析和信息工具。",
    featuresIntro: "在一个页面查看所有重要比赛信息：统计数据、人工智能、概率、比赛走势和实时信号。",

    sectionTitle: "专为追求更深入分析的用户设计",
    sectionText: "Irvin Analytics 不承诺轻松获利。它通过真实数据、数学模型和人工智能分析足球比赛，帮助您减少猜测，做出更明智的决策。",
    plansIntro: "选择月度订阅方案，开始使用 Irvin Analytics。",
    betaDesc: "体验平台的基础访问权限。",
    premiumDesc: "实时比赛直播、报告和高级人工智能。",
    vipDesc: "完整使用所有高级功能。",
    activate: "开通",
    popular: "最受欢迎",
    disclaimer: "责任声明：Irvin Analytics 提供体育统计分析。预测不保证结果。用户应自行负责信息的使用。",

    cards: [{"title": "实时比赛直播", "text": "通过比赛数据、事件和概率实时追踪赛事。"}, {"title": "预测人工智能", "text": "泊松模型、下一粒进球、双方进球、大小球、预测比分及智能分析。"}, {"title": "比赛走势", "text": "分析比赛控制力，识别哪支球队正在制造更多威胁。"}, {"title": "高级报告", "text": "每日提供精选比赛、概率及统计分析报告。"}, {"title": "实时数据", "text": "持续更新统计数据、进球、射门、角球、黄红牌及比赛事件。"}, {"title": "私人访问", "text": "具有用户、订阅方案、许可证和访问权限管理的安全平台。"}],
        heroDescription: "人工智能体育分析私人平台。分析实时比赛、追踪比赛走势、计算概率并生成高级报告，帮助您做出更明智的决策。",
badge: "实时体育人工智能",
    demo: "查看实时演示",
    login: "登录",
    features: "您可以分析什么？",
    plans: "订阅方案"
  }
};

export function useHomeTranslations() {
  const language = useLanguage();
  return messages[language as keyof typeof messages] ?? messages.es;
}
