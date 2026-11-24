// Тексты фраз голоса. {name} заменяется на имя ребёнка из data/index.js,
// {machine} — на название машины в винительном падеже (фраза machine-<id>-acc).
export const phrases = {
  // машины: именительный и винительный падеж («собери трактор»)
  'machine-samosval': 'Самосвал',
  'machine-samosval-acc': 'самосвал',
  'machine-traktor': 'Трактор',
  'machine-traktor-acc': 'трактор',
  'machine-buldozer': 'Бульдозер',
  'machine-buldozer-acc': 'бульдозер',
  'machine-katok': 'Каток',
  'machine-katok-acc': 'каток',
  'machine-betonomeshalka': 'Бетономешалка',
  'machine-betonomeshalka-acc': 'бетономешалку',
  'machine-ekskavator': 'Экскаватор',
  'machine-ekskavator-acc': 'экскаватор',
  'machine-pogruzchik': 'Погрузчик',
  'machine-pogruzchik-acc': 'погрузчик',
  'machine-avtokran': 'Автокран',
  'machine-avtokran-acc': 'автокран',
  'machine-greider': 'Грейдер',
  'machine-greider-acc': 'грейдер',
  'machine-bashennyi-kran': 'Башенный кран',
  'machine-bashennyi-kran-acc': 'башенный кран',

  // детали: одна фраза на id детали, общая для всех машин
  'part-rama': 'Рама!',
  'part-koleso-zadnee': 'Задние колёса!',
  'part-koleso-perednee': 'Переднее колесо!',
  'part-kuzov': 'Кузов!',
  'part-kabina': 'Кабина!',
  'part-pricep': 'Прицеп!',
  'part-motor': 'Мотор!',
  'part-gusenica': 'Гусеницы!',
  'part-otval': 'Отвал!',
  'part-truba': 'Труба!',
  'part-fara': 'Фара!',
  'part-valec': 'Валец!',
  'part-baraban': 'Барабан!',
  'part-lotok': 'Лоток!',
  'part-bak-vody': 'Бак для воды!',
  'part-korpus': 'Корпус!',
  'part-protivoves': 'Противовес!',
  'part-strela': 'Стрела!',
  'part-rukoyat': 'Рукоять!',
  'part-kovsh': 'Ковш!',
  'part-lestnica': 'Лесенка!',
  'part-kabina-krana': 'Кабина крановщика!',
  'part-kryuk': 'Крюк!',
  'part-opory': 'Опоры!',
  'part-nozh': 'Нож!',
  'part-mayachok': 'Мигалка!',
  'part-osnova': 'Основание!',
  'part-bashnya': 'Башня!',
  'part-sekciya-bashni': 'Ещё кусок башни!',
  'part-verhushka': 'Верхушка!',
  'part-sekciya-strely': 'Конец стрелы!',
  'part-kontrstrela': 'Короткая стрела!',

  // главный экран
  'home-hint': '{name}, нажми на гараж!',
  'home-closed': 'Сюда поедем потом!',
  'home-ready': '{name}, нажми на машину! Соберём её ещё раз?',

  // гараж
  'garage-hint': '{name}, выбери машину!',
  'garage-actions': 'Что будем делать? Собрать, пазл или помыть?',
  'garage-new': 'Новая машина приехала! Давай её соберём!',
  'garage-locked': 'Эта машина ещё не приехала. Собери другие машины!',

  // сборка
  'assembly-task': '{name}, собери {machine}! Перетащи детали на место.',
  'assembly-hint': '{name}, возьми деталь пальцем и перенеси её на место.',
  'assembly-done': 'Ура! Машина собрана! Поехали!',

  // пазл
  'puzzle-task': '{name}, собери картинку! Перетащи кусочки.',
  'puzzle-hint': 'Возьми кусочек и поставь его на место.',
  'puzzle-done': 'Картинка собрана!',
  'puzzle-locked': 'Сначала собери маленький пазл!',

  // мойка
  'wash-water': '{name}, полей машину водой!',
  'wash-foam': 'Теперь натри пеной!',
  'wash-rinse': 'Смой пену водой!',
  'wash-stubborn': 'Ой, грязь осталась! Помоем ещё раз',
  'wash-hint': 'Води пальцем по машине.',
  'wash-done': 'Машина блестит!',

  // мастерская
  'repair-wheel': 'Колесо спустило! Накачай его насосом.',
  'repair-rust': 'Ржавчина! Потри пальцем, чтобы её убрать.',
  'repair-paint': 'Краска облезла! Выбери краску и закрась.',
  'repair-hint-wheel': 'Нажимай на насос!',
  'repair-hint-rub': 'Три пальцем пятно.',
  'repair-done': 'Машина как новая!',

  // заправка
  'fuel-task': '{name}, заправь {machine}! Поднеси шланг к баку.',
  'fuel-hint': 'Возьми шланг и держи у бака.',
  'fuel-done': 'Бак полный! Поехали!',

  // таймер
  'timer-warning': 'Машины скоро поедут спать.',
};
