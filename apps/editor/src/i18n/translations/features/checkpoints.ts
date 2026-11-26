export const translations = {
  'feature.checkpoints.error.create-failed': {
    en: 'Failed to create checkpoint: {error}',
    pl: 'Nie udało się utworzyć punktu kontrolnego: {error}',
    'zh-cn': '创建检查点失败：{error}',
    ja: 'チェックポイントの作成に失敗しました: {error}',
    'zh-tw': '建立檢查點失敗：{error}',
    de: 'Fehler beim Erstellen des Prüfpunkts: {error}',
    es: 'Error al crear el punto de control: {error}',
    fr: 'Échec de la création du point de contrôle : {error}',
    'pt-br': 'Falha ao criar o ponto de verificação: {error}',
    ru: 'Не удалось создать контрольную точку: {error}',
    ko: '체크포인트 생성 실패: {error}',
    it: 'Creazione del punto di controllo non riuscita: {error}',
    tr: 'Kontrol noktası oluşturulamadı: {error}',
    cs: 'Nepodařilo se vytvořit kontrolní bod: {error}',
    hu: 'Nem sikerült létrehozni az ellenőrzőpontot: {error}',
    bg: 'Неуспешно създаване на контролна точка: {error}'
  },
  'feature.checkpoints.warning.operation-in-progress': {
    en: 'Another checkpoint operation is currently in progress. Please wait for it to complete.',
    pl: 'Obecnie trwa inna operacja na punktach kontrolnych. Proszę poczekać na jej zakończenie.',
    'zh-cn': '当前正在进行另一个检查点操作。请等待其完成。',
    ja: '現在、別のチェックポイント操作が進行中です。完了するまでお待ちください。',
    'zh-tw': '目前正在進行另一個檢查點操作。請等待其完成。',
    de: 'Eine weitere Prüfpunktoperation ist derzeit in Bearbeitung. Bitte warten Sie, bis sie abgeschlossen ist.',
    es: 'Actualmente hay otra operación de punto de control en progreso. Por favor, espere a que se complete.',
    fr: "Une autre opération de point de contrôle est actuellement en cours. Veuillez attendre qu'elle se termine.",
    'pt-br':
      'Outra operação de ponto de verificação está em andamento. Aguarde sua conclusão.',
    ru: 'В настоящее время выполняется другая операция с контрольной точкой. Пожалуйста, дождитесь ее завершения.',
    ko: '현재 다른 체크포인트 작업이 진행 중입니다. 완료될 때까지 기다려주세요.',
    it: "Un'altra operazione del punto di controllo è attualmente in corso. Si prega di attendere il suo completamento.",
    tr: 'Şu anda başka bir kontrol noktası işlemi devam ediyor. Lütfen tamamlanmasını bekleyin.',
    cs: 'V současné době probíhá jiná operace s kontrolními body. Počkejte prosím na její dokončení.',
    hu: 'Jelenleg egy másik ellenőrzőpont művelet van folyamatban. Kérjük, várja meg, amíg befejeződik.',
    bg: 'В момента се изпълнява друга операция с контролна точка. Моля, изчакайте да завърши.'
  },
  'feature.checkpoints.info.skipped-folders': {
    en: 'Some workspace folders were not included in the checkpoint because they are not Git repositories.',
    pl: 'Niektóre foldery obszaru roboczego nie zostały uwzględnione w punkcie kontrolnym, ponieważ nie są repozytoriami Git.',
    'zh-cn': '由于不是 Git 仓库，某些工作区文件夹未包含在检查点中。',
    ja: 'Git リポジトリではないため、一部のワークスペースフォルダはチェックポイントに含まれませんでした。',
    'zh-tw': '由於不是 Git 儲存庫，某些工作區資料夾未包含在檢查點中。',
    de: 'Einige Arbeitsbereichsordner wurden nicht in den Prüfpunkt aufgenommen, da sie keine Git-Repositories sind.',
    es: 'Algunas carpetas del espacio de trabajo no se incluyeron en el punto de control porque no son repositorios de Git.',
    fr: 'Certains dossiers de l’espace de travail n’ont pas été inclus dans le point de contrôle car ce ne sont pas des dépôts Git.',
    'pt-br':
      'Algumas pastas do espaço de trabalho não foram incluídas no ponto de verificação porque não são repositórios Git.',
    ru: 'Некоторые папки рабочей области не были включены в контрольную точку, так как они не являются репозиториями Git.',
    ko: '일부 작업 영역 폴더는 Git 저장소가 아니므로 체크포인트에 포함되지 않았습니다.',
    it: 'Alcune cartelle dell’area di lavoro non sono state incluse nel punto di controllo perché non sono repository Git.',
    tr: 'Bazı çalışma alanı klasörleri Git deposu olmadıkları için kontrol noktasına dahil edilmedi.',
    cs: 'Některé složky pracovního prostoru nebyly zahrnuty do kontrolního bodu, protože nejsou repozitáři Git.',
    hu: 'Egyes munkaterületi mappák nem kerültek bele az ellenőrzőpontba, mert nem Git-tárolók.',
    bg: 'Някои папки от работното пространство не бяха включени в контролната точка, тъй като не са Git хранилища.'
  }
} as const
