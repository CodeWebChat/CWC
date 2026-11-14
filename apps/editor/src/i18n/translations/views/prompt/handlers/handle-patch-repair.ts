export const translations = {
  'views.prompt.handlers.handle-patch-repair.error.patch-repair-context-not-found':
    {
      en: 'Could not find the context for patch repair. Please apply the changes again.',
      pl: 'Nie znaleziono kontekstu dla naprawy łatki. Zastosuj zmiany ponownie.',
      'zh-cn': '找不到补丁修复的上下文。请再次应用更改。',
      ja: 'パッチ修復のコンテキストが見つかりませんでした。変更を再度適用してください。',
      'zh-tw': '找不到修補程式修復的上下文。請再次套用變更。',
      de: 'Der Kontext für die Patch-Reparatur konnte nicht gefunden werden. Bitte wenden Sie die Änderungen erneut an.',
      es: 'No se pudo encontrar el contexto para la reparación del parche. Vuelva a aplicar los cambios.',
      fr: 'Impossible de trouver le contexte pour la réparation du correctif. Veuillez appliquer les modifications à nouveau.',
      'pt-br':
        'Não foi possível encontrar o contexto para o reparo do patch. Aplique as alterações novamente.',
      ru: 'Не удалось найти контекст для исправления патча. Пожалуйста, примените изменения снова.',
      ko: '패치 복구를 위한 컨텍스트를 찾을 수 없습니다. 변경 사항을 다시 적용해 주세요.',
      it: 'Impossibile trovare il contesto per la riparazione della patch. Applica nuovamente le modifiche.',
      tr: 'Yama onarımı için bağlam bulunamadı. Lütfen değişiklikleri tekrar uygulayın.',
      cs: 'Nepodařilo se najít kontext pro opravu záplaty. Znovu aplikujte změny.',
      hu: 'A javítás helyreállításához nem található a kontextus. Kérjük, alkalmazza újra a változtatásokat.',
      bg: 'Контекстът за поправка на пача не може да бъде намерен. Моля, приложете промените отново.'
    },
  'views.prompt.handlers.handle-patch-repair.error.applying-changes-generic-error':
    {
      en: 'An error occurred while applying changes ({msg}).',
      pl: 'Wystąpił błąd podczas wprowadzania zmian ({msg}).',
      'zh-cn': '应用更改时出错（{msg}）。',
      ja: '変更を適用中にエラーが発生しました（{msg}）。',
      'zh-tw': '套用變更時出錯（{msg}）。',
      de: 'Beim Anwenden der Änderungen ist ein Fehler aufgetreten ({msg}).',
      es: 'Ocurrió un error al aplicar los cambios ({msg}).',
      fr: "Une erreur s'est produite lors de l'application des modifications ({msg}).",
      'pt-br': 'Ocorreu um erro ao aplicar as alterações ({msg}).',
      ru: 'Во время применения изменений произошла ошибка ({msg}).',
      ko: '변경 사항을 적용하는 동안 오류가 발생했습니다 ({msg}).',
      it: "Si è verificato un errore durante l'applicazione delle modifiche ({msg}).",
      tr: 'Değişiklikler uygulanırken bir hata oluştu ({msg}).',
      cs: 'Při aplikaci změn došlo k chybě ({msg}).',
      hu: 'Hiba történt a változások alkalmazása közben ({msg}).',
      bg: 'Възникна грешка при прилагане на промените ({msg}).'
    }
} as const
