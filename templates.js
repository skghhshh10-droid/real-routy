// Routy Travel App MVP - Templates and Mock AI Engine

const PREDEFINED_TEMPLATES = {
  parents: {
    id: "parents",
    title: "부모님 효도 여행 (교토-오사카 3일)",
    description: "부모님과의 첫 해외여행을 위한 편안하고 여유로운 전통 힐링 코스",
    destination: "교토/오사카",
    duration: 3,
    budget: "high",
    style: "relaxing",
    places: [
      // Day 1
      {
        day: 1,
        id: "p1",
        name: "간사이 국제공항",
        time: "10:30 - 11:30",
        lat: 34.432,
        lng: 135.230,
        category: "transit",
        description: "간사이 공항 도착 및 입국 수속. 하루카 특급열차 탑승 준비.",
        bookingUrl: "https://www.klook.com/ko/search?query=하루카"
      },
      {
        day: 1,
        id: "p2",
        name: "교토역 & 하루카 열차",
        time: "11:30 - 13:00",
        lat: 34.985,
        lng: 135.758,
        category: "transit",
        description: "공항에서 교토역까지 하루카 특급열차로 편안하게 이동 (약 75분 소요).",
        bookingUrl: "https://www.klook.com/ko/search?query=교토 하루카"
      },
      {
        day: 1,
        id: "p3",
        name: "교토 가이세키 요리 전문점 (점심)",
        time: "13:00 - 14:00",
        lat: 35.003,
        lng: 135.772,
        category: "restaurant",
        description: "부모님 입맛에 맞는 자극적이지 않고 정갈한 전통 일식 가이세키 정식.",
        bookingUrl: "https://search.naver.com/search.naver?query=교토+가이세키+맛집"
      },
      {
        day: 1,
        id: "p3_transit",
        name: "교토 시내버스 (206번)",
        time: "14:00 - 14:30",
        lat: 35.000,
        lng: 135.778,
        category: "transit",
        description: "교토역 D2 승차장에서 206번 버스 탑승 후 기요미즈미치 정류장 하차.",
        bookingUrl: ""
      },
      {
        day: 1,
        id: "p4",
        name: "청수사 (기요미즈데라)",
        time: "14:30 - 16:30",
        lat: 34.9948,
        lng: 135.7850,
        category: "sightseeing",
        description: "교토 전경이 한눈에 내려다보이는 전통 사찰 산책. 완만한 경사로 안내 필수.",
        bookingUrl: "https://www.klook.com/ko/search?query=청수사"
      },
      {
        day: 1,
        id: "p4_transit",
        name: "일반 택시",
        time: "16:30 - 17:00",
        lat: 35.001,
        lng: 135.772,
        category: "transit",
        description: "청수사 입구 택시 승차장에서 택시 탑승하여 호텔로 이동 (약 15분 소요).",
        bookingUrl: ""
      },
      {
        day: 1,
        id: "p5",
        name: "교토 미쓰이 가든 호텔 (숙소)",
        time: "17:00 - 18:00",
        lat: 35.006,
        lng: 135.759,
        category: "hotel",
        description: "대욕탕이 있어 여행 후 부모님의 피로를 풀기 아주 좋은 프리미엄 힐링 호텔.",
        bookingUrl: "https://www.agoda.com/search?q=Mitsui Garden Hotel Kyoto"
      },
      // Day 2
      {
        day: 2,
        id: "p6",
        name: "아라시야마 대나무숲 (치쿠린)",
        time: "09:30 - 11:30",
        lat: 35.0156,
        lng: 135.6715,
        category: "sightseeing",
        description: "이른 아침의 맑은 공기와 웅장한 대나무 숲길 산책. 인력거 투어 추천.",
        bookingUrl: "https://www.klook.com/ko/search?query=아라시야마 인력거"
      },
      {
        day: 2,
        id: "p7",
        name: "금각사 (킨카쿠지)",
        time: "12:00 - 13:30",
        lat: 35.0394,
        lng: 135.7292,
        category: "sightseeing",
        description: "황금빛으로 빛나는 사찰과 연못이 어우러진 정원에서 부모님 인생샷 촬영.",
        bookingUrl: "https://www.klook.com/ko/search?query=금각사"
      },
      {
        day: 2,
        id: "p8",
        name: "니시키 시장",
        time: "14:00 - 15:30",
        lat: 35.0050,
        lng: 135.7656,
        category: "restaurant",
        description: "교토의 부엌이라 불리는 시장에서 꼬치구이, 말차 아이스크림 등 다양한 먹거리 체험.",
        bookingUrl: "https://search.naver.com/search.naver?query=교토+니시키시장+먹거리"
      },
      {
        day: 2,
        id: "p9",
        name: "폰토초 골목 산책 및 저녁식사",
        time: "18:00 - 20:00",
        lat: 35.0048,
        lng: 135.7712,
        category: "restaurant",
        description: "강가를 보며 교토 전통 전골 요리인 '스키야키' 또는 샤브샤브 식사.",
        bookingUrl: "https://search.naver.com/search.naver?query=교토+스키야키+맛집"
      },
      // Day 3
      {
        day: 3,
        id: "p10",
        name: "후시미 이나리 신사 (여우신사)",
        time: "09:00 - 10:30",
        lat: 34.9671,
        lng: 135.7727,
        category: "sightseeing",
        description: "붉은색 토리이 터널이 끝없이 이어지는 신비로운 분위기의 사찰 투어.",
        bookingUrl: "https://www.klook.com/ko/search?query=후시미이나리"
      },
      {
        day: 3,
        id: "p11",
        name: "오사카성",
        time: "11:30 - 13:30",
        lat: 34.6873,
        lng: 135.5262,
        category: "sightseeing",
        description: "오사카로 이동하여 대표 랜드마크 방문. 로드 트레인을 타고 성 입구까지 편하게 이동.",
        bookingUrl: "https://www.klook.com/ko/search?query=오사카성"
      },
      {
        day: 3,
        id: "p12",
        name: "도톤보리 & 글리코상",
        time: "14:00 - 16:30",
        lat: 34.6687,
        lng: 135.5013,
        category: "sightseeing",
        description: "유명한 글리코상 앞에서 기념 촬영 후 타코야키 간식 타임 및 쇼핑.",
        bookingUrl: "https://search.naver.com/search.naver?query=오사카+도톤보리+맛집"
      }
    ]
  },
  couple: {
    id: "couple",
    title: "커플 감성 힐링 여행 (제주 3일)",
    description: "푸른 바다와 감성 카페, 오션뷰 숙소와 낭만적인 노을이 함께하는 2박 3일 데이트 코스",
    destination: "제주도",
    duration: 3,
    budget: "medium",
    style: "active",
    places: [
      // Day 1
      {
        day: 1,
        id: "c1",
        name: "제주국제공항",
        time: "09:30 - 10:30",
        lat: 33.5113,
        lng: 126.4930,
        category: "transit",
        description: "공항 도착 후 렌터카 하우스로 이동하여 차량 인수.",
        bookingUrl: "https://search.naver.com/search.naver?query=제주도+렌트카+비교"
      },
      {
        day: 1,
        id: "c2",
        name: "애월 한담해안산책로",
        time: "11:00 - 12:00",
        lat: 33.4616,
        lng: 126.3121,
        category: "sightseeing",
        description: "에메랄드빛 애월 바다를 보며 걷는 로맨틱한 해안 도로 산책 코스.",
        bookingUrl: "https://search.naver.com/search.naver?query=한담해안산책로"
      },
      {
        day: 1,
        id: "c2_transit",
        name: "제주 시내버스 (202번)",
        time: "12:00 - 12:30",
        lat: 33.428,
        lng: 126.275,
        category: "transit",
        description: "한담동 정류장에서 202번 일반 버스를 탑승하여 협재해수욕장 정류장으로 이동.",
        bookingUrl: ""
      },
      {
        day: 1,
        id: "c3",
        name: "협재 해수욕장 & 점심식사",
        time: "12:30 - 14:00",
        lat: 33.3940,
        lng: 126.2397,
        category: "restaurant",
        description: "비양도가 보이는 오션뷰 식당에서 제주 보말 칼국수와 돔베고기 점심식사.",
        bookingUrl: "https://search.naver.com/search.naver?query=협재해수욕장+맛집"
      },
      {
        day: 1,
        id: "c4",
        name: "인스밀 (감성 카페)",
        time: "15:00 - 16:30",
        lat: 33.2483,
        lng: 126.2572,
        category: "cafe",
        description: "이국적인 야자수와 돌담이 어우러진 붉은 흙 마당의 초감성 보리개역 맛집 카페.",
        bookingUrl: "https://search.naver.com/search.naver?query=제주+인스밀"
      },
      {
        day: 1,
        id: "c5",
        name: "제주 광이멀 풀빌라 (숙소)",
        time: "17:30 - 19:30",
        lat: 33.3768,
        lng: 126.3458,
        category: "hotel",
        description: "독채로 프라이빗하게 즐기는 감성 풀빌라. 자쿠지와 불멍 시설 완비.",
        bookingUrl: "https://www.agoda.com/search?q=Gwangimul Pool Villa Jeju"
      },
      // Day 2
      {
        day: 2,
        id: "c6",
        name: "사려니숲길",
        time: "10:00 - 12:00",
        lat: 33.4024,
        lng: 126.6437,
        category: "sightseeing",
        description: "하늘 높이 뻗은 삼나무 숲속에서 맑은 공기를 마시며 힐링하는 산책길.",
        bookingUrl: "https://search.naver.com/search.naver?query=사려니숲길"
      },
      {
        day: 2,
        id: "c7",
        name: "성산일출봉",
        time: "13:00 - 14:30",
        lat: 33.4585,
        lng: 126.9421,
        category: "sightseeing",
        description: "유네스코 세계자연유산의 웅장한 분화구 관람. 무료 산책로도 풍경이 아름다움.",
        bookingUrl: "https://www.klook.com/ko/search?query=성산일출봉"
      },
      {
        day: 2,
        id: "c8",
        name: "제주 전복돌솥밥 맛집 (점심)",
        time: "14:45 - 15:45",
        lat: 33.4552,
        lng: 126.9125,
        category: "restaurant",
        description: "고소한 게우가 들어간 영양 만점 전복 돌솥밥과 버터 전복구이 한 상.",
        bookingUrl: "https://search.naver.com/search.naver?query=성산+전복돌솥밥+맛집"
      },
      {
        day: 2,
        id: "c9",
        name: "비자림",
        time: "16:15 - 17:45",
        lat: 33.4913,
        lng: 126.8113,
        category: "sightseeing",
        description: "천년의 세월을 간직한 비자나무 자생 숲길. 고요하고 아늑한 자연 치유 공간.",
        bookingUrl: "https://search.naver.com/search.naver?query=비자림"
      },
      // Day 3
      {
        day: 3,
        id: "c10",
        name: "함덕 해수욕장 & 서우봉",
        time: "10:00 - 11:30",
        lat: 33.5430,
        lng: 126.6693,
        category: "sightseeing",
        description: "한국의 몰디브라 불리는 투명한 해변. 서우봉에 올라 함덕 해변 전경 조망.",
        bookingUrl: "https://search.naver.com/search.naver?query=함덕해수욕장"
      },
      {
        day: 3,
        id: "c11",
        name: "델문도 카페",
        time: "11:45 - 13:00",
        lat: 33.5438,
        lng: 126.6685,
        category: "cafe",
        description: "바다 바로 위에 떠 있는 듯한 야외 테라스가 인상적인 시그니처 오션뷰 베이커리 카페.",
        bookingUrl: "https://search.naver.com/search.naver?query=카페+델문도"
      },
      {
        day: 3,
        id: "c12",
        name: "동문시장 청년몰 & 기념품 구매",
        time: "13:30 - 15:30",
        lat: 33.5126,
        lng: 126.5283,
        category: "shopping",
        description: "제주 전통 야시장 및 기념품점 방문. 오메기떡, 감귤 초콜릿 등 구매.",
        bookingUrl: "https://search.naver.com/search.naver?query=제주+동문시장"
      }
    ]
  },
  tokyo: {
    id: "tokyo",
    title: "트렌디한 도쿄 핵심 정복 (도쿄 3일)",
    description: "쇼핑, 야경, 감성 카페, 애니메이션 성지까지 요즘 가장 핫한 도쿄의 알짜배기 일정",
    destination: "도쿄",
    duration: 3,
    budget: "medium",
    style: "active",
    places: [
      // Day 1
      {
        day: 1,
        id: "t1",
        name: "나리타 국제공항",
        time: "11:00 - 12:00",
        lat: 35.7720,
        lng: 140.3929,
        category: "transit",
        description: "공항 도착 후 스카이라이너 승차권 교환 후 닛포리/우에노행 탑승.",
        bookingUrl: "https://www.klook.com/ko/search?query=나리타 스카이라이너"
      },
      {
        day: 1,
        id: "t1_transit",
        name: "도쿄 지하철 (야마노테선)",
        time: "12:00 - 13:00",
        lat: 35.713,
        lng: 139.771,
        category: "transit",
        description: "닛포리역에서 JR 야마노테선으로 환승하여 시부야역까지 이동.",
        bookingUrl: ""
      },
      {
        day: 1,
        id: "t2",
        name: "시부야 스크램블 교차로",
        time: "13:00 - 14:30",
        lat: 35.6595,
        lng: 139.7005,
        category: "sightseeing",
        description: "도쿄의 상징인 거대한 보행자 교차로 횡단 체험. 스타벅스 2층 명당 자리 추천.",
        bookingUrl: "https://search.naver.com/search.naver?query=시부야+스크램블교차로"
      },
      {
        day: 1,
        id: "t3",
        name: "시부야 스카이 (전망대)",
        time: "16:00 - 18:00",
        lat: 35.6585,
        lng: 139.7015,
        category: "sightseeing",
        description: "시부야 상공 229m에서 360도로 펼쳐지는 도쿄 파노라마 노을 & 야경 명소.",
        bookingUrl: "https://www.klook.com/ko/search?query=시부야스카이"
      },
      {
        day: 1,
        id: "t4",
        name: "시부야 고기 요리 마크시티 (저녁식사)",
        time: "18:30 - 20:30",
        lat: 35.6582,
        lng: 139.6978,
        category: "restaurant",
        description: "입안에서 사르르 녹는 고급 흑우 야키니쿠 무한리필 또는 야키토리 골목 맥주 한잔.",
        bookingUrl: "https://search.naver.com/search.naver?query=시부야+야키니쿠+맛집"
      },
      {
        day: 1,
        id: "t5",
        name: "시부야 스트림 엑셀 호텔 도큐 (숙소)",
        time: "21:00 - 22:00",
        lat: 35.6570,
        lng: 139.7028,
        category: "hotel",
        description: "시부야 역과 바로 연결되는 트렌디하고 감각적인 디자인의 최고 입지 호텔.",
        bookingUrl: "https://www.agoda.com/search?q=Shibuya Stream Excel Hotel Tokyu"
      },
      // Day 2
      {
        day: 2,
        id: "t6",
        name: "센소지 (아사쿠사)",
        time: "09:30 - 11:30",
        lat: 35.7148,
        lng: 139.7967,
        category: "sightseeing",
        description: "도쿄에서 가장 오래된 절. 나카미세도리 상점가에서 화과자와 인형 구이 등 전통 디저트 맛보기.",
        bookingUrl: "https://www.klook.com/ko/search?query=센소지 아사쿠사"
      },
      {
        day: 2,
        id: "t7",
        name: "아키하바라 전자상가 & 메이드 카페",
        time: "12:00 - 14:30",
        lat: 35.6997,
        lng: 139.7715,
        category: "sightseeing",
        description: "피규어, 게임, 애니메이션 굿즈의 천국. 아키하바라 이색 메이드 카페 음료 체험.",
        bookingUrl: "https://www.klook.com/ko/search?query=아키하바라"
      },
      {
        day: 2,
        id: "t8",
        name: "긴자 6 쇼핑몰 & 스시 (점심식사)",
        time: "15:00 - 17:30",
        lat: 35.6696,
        lng: 139.7640,
        category: "shopping",
        description: "도쿄 최고급 쇼핑가 긴자의 랜드마크. 쓰키지 시장 직송 신선한 스시 오마카세.",
        bookingUrl: "https://search.naver.com/search.naver?query=긴자+스시+맛집"
      },
      {
        day: 2,
        id: "t9",
        name: "도쿄 타워 & 시바 공원",
        time: "18:30 - 20:30",
        lat: 35.6586,
        lng: 139.7454,
        category: "sightseeing",
        description: "잔디밭에 누워 주황빛으로 빛나는 낭만적인 도쿄타워를 바라보는 감성 스팟.",
        bookingUrl: "https://www.klook.com/ko/search?query=도쿄타워"
      },
      // Day 3
      {
        day: 3,
        id: "t10",
        name: "메이지 신궁 & 하라주쿠",
        time: "10:00 - 12:00",
        lat: 35.6764,
        lng: 139.6993,
        category: "sightseeing",
        description: "울창한 숲길을 걷는 도심 속 힐링 사찰 투어. 하라주쿠 타케시타 거리의 크레페 맛보기.",
        bookingUrl: "https://search.naver.com/search.naver?query=메이지신궁"
      },
      {
        day: 3,
        id: "t11",
        name: "오모테산도 힐즈 & 블루보틀",
        time: "12:15 - 14:00",
        lat: 35.6672,
        lng: 139.7090,
        category: "cafe",
        description: "명품 샵과 독특한 건축물들이 늘어선 세련된 거리. 고소한 블루보틀 드립 커피 테이크아웃.",
        bookingUrl: "https://search.naver.com/search.naver?query=오모테산도+블루보틀"
      },
      {
        day: 3,
        id: "t12",
        name: "신주쿠 돈키호테 & 백화점 지하 푸드숍",
        time: "14:30 - 16:30",
        lat: 35.6923,
        lng: 139.7020,
        category: "shopping",
        description: "공항 가기 전 마지막 폭풍 쇼핑. 백화점 데파치카 식품관에서 디저트 및 간식 구매.",
        bookingUrl: "https://search.naver.com/search.naver?query=신주쿠+돈키호테"
      }
    ]
  },
  gyeongju: {
    id: "gyeongju",
    title: "역사와 감성의 조화 (경주 힐링 3일)",
    description: "신라의 천년 고도 유적들과 황리단길의 아기자기한 한옥 카페가 만나는 국내 힐링 여행",
    destination: "경주",
    duration: 3,
    budget: "low",
    style: "relaxing",
    places: [
      // Day 1
      {
        day: 1,
        id: "g1",
        name: "경주역 (KTX)",
        time: "10:00 - 10:20",
        lat: 35.7979,
        lng: 129.1368,
        category: "transit",
        description: "경주역 KTX 열차 도착 및 하차 수속.",
        bookingUrl: "https://search.naver.com/search.naver?query=레츠코레일+기차표+예매"
      },
      {
        day: 1,
        id: "g1_transit",
        name: "경주 시내버스 (700번)",
        time: "10:20 - 10:50",
        lat: 35.815,
        lng: 129.172,
        category: "transit",
        description: "경주역 버스 승강장에서 700번 버스를 탑승하여 황리단길(경주 시내)로 이동.",
        bookingUrl: ""
      },
      {
        day: 1,
        id: "g2",
        name: "황리단길 한옥 카페 골목 (점심식사)",
        time: "10:50 - 12:30",
        lat: 35.8365,
        lng: 129.2085,
        category: "restaurant",
        description: "감성 가득한 한옥 한정식 또는 경주식 한우 갈비찜 식사 후 예쁜 말차 카페 방문.",
        bookingUrl: "https://search.naver.com/search.naver?query=황리단길+맛집"
      },
      {
        day: 1,
        id: "g3",
        name: "대릉원 & 천마총",
        time: "13:30 - 15:30",
        lat: 35.8385,
        lng: 129.2120,
        category: "sightseeing",
        description: "초록빛 둥근 고분 사이를 산책하는 경주의 상징적인 길. 목련나무 포토존 대기 필수.",
        bookingUrl: "https://search.naver.com/search.naver?query=경주+대릉원"
      },
      {
        day: 1,
        id: "g4",
        name: "경주 첨성대",
        time: "16:00 - 17:30",
        lat: 35.8347,
        lng: 129.2190,
        category: "sightseeing",
        description: "동양에서 가장 오래된 천문대 주변 핑크뮬리 및 계절 꽃밭 산책 코스.",
        bookingUrl: "https://search.naver.com/search.naver?query=첨성대"
      },
      {
        day: 1,
        id: "g5",
        name: "동궁과 월지 (안압지 야경)",
        time: "18:30 - 20:00",
        lat: 35.8342,
        lng: 129.2265,
        category: "sightseeing",
        description: "화려하게 불이 켜진 궁궐 전각이 잔잔한 연못에 비치는 경주 최고의 야경 명소.",
        bookingUrl: "https://search.naver.com/search.naver?query=동궁과월지"
      },
      {
        day: 1,
        id: "g6",
        name: "경주 소담한옥 게스트하우스 (숙소)",
        time: "20:30 - 21:30",
        lat: 35.8360,
        lng: 129.2095,
        category: "hotel",
        description: "대릉원 인근에 위치하여 밤 산책하기 좋은 전통 한옥 서까래 감성 게스트하우스.",
        bookingUrl: "https://www.agoda.com/search?q=Gyeongju Hanok Guesthouse"
      },
      // Day 2
      {
        day: 2,
        id: "g7",
        name: "불국사",
        time: "09:30 - 11:30",
        lat: 35.7901,
        lng: 129.3323,
        category: "sightseeing",
        description: "다보탑과 석가탑이 있는 호국 불교의 정수 사찰. 계절별로 단풍과 겹벚꽃이 절정.",
        bookingUrl: "https://search.naver.com/search.naver?query=경주+불국사"
      },
      {
        day: 2,
        id: "g8",
        name: "경주 순두부 골목 (점심식사)",
        time: "12:00 - 13:00",
        lat: 35.8450,
        lng: 129.2550,
        category: "restaurant",
        description: "불국사 인근 또는 북군동 음식촌의 고소하고 칼칼한 가마솥 수제 순두부찌개.",
        bookingUrl: "https://search.naver.com/search.naver?query=경주+순두부+맛집"
      },
      {
        day: 2,
        id: "g9",
        name: "석굴암 Grotto",
        time: "13:30 - 15:00",
        lat: 35.7950,
        lng: 129.3490,
        category: "sightseeing",
        description: "토함산 자락에 숨겨진 신비로운 인공 석굴 사찰. 불상 앞 관람 및 동해 조망.",
        bookingUrl: "https://search.naver.com/search.naver?query=석굴암"
      },
      {
        day: 2,
        id: "g10",
        name: "보문관광단지 & 보문호 산책",
        time: "15:30 - 17:30",
        lat: 35.8465,
        lng: 129.2785,
        category: "sightseeing",
        description: "보문호를 따라 조성된 산책길을 걸으며 힐링. 오리배 탑승 또는 카페 테라스 이용.",
        bookingUrl: "https://search.naver.com/search.naver?query=보문관광단지"
      },
      // Day 3
      {
        day: 3,
        id: "g11",
        name: "교촌 한옥마을 & 최부자댁",
        time: "10:00 - 11:30",
        lat: 35.8290,
        lng: 129.2155,
        category: "sightseeing",
        description: "교리김밥 등 유명 간식거리가 있는 한옥 마을 관람. 최부자의 나눔 정신 고택 탐방.",
        bookingUrl: "https://search.naver.com/search.naver?query=경주+교촌마을"
      },
      {
        day: 3,
        id: "g12",
        name: "월정교 (교동교)",
        time: "11:30 - 12:30",
        lat: 35.8294,
        lng: 129.2181,
        category: "sightseeing",
        description: "남천을 가로지르는 웅장한 목조 교량. 다리 내부를 걸으며 신라 건축의 미학 감상.",
        bookingUrl: "https://search.naver.com/search.naver?query=월정교"
      },
      {
        day: 3,
        id: "g13",
        name: "경주 국립박물관",
        time: "13:30 - 15:30",
        lat: 35.8300,
        lng: 129.2290,
        category: "sightseeing",
        description: "성덕대왕신종(에밀레종)과 화려한 금관 등 신라 황금 유적을 관람하는 유익한 실내 코스.",
        bookingUrl: "https://search.naver.com/search.naver?query=국립경주박물관"
      }
    ]
  },
  busan: {
    id: "busan",
    title: "부산 감성 바다 & 맛집 투어 (부산 3일)",
    description: "광안대교 오션뷰, 감천문화마을의 알록달록한 골목길, 신선한 해산물과 로컬 노포 맛집이 가득한 2박 3일 힐링 코스",
    destination: "부산",
    duration: 3,
    budget: "medium",
    style: "active",
    places: [
      // Day 1
      {
        day: 1,
        id: "b1",
        name: "부산역 (KTX)",
        time: "10:00 - 10:30",
        lat: 35.1152,
        lng: 129.0422,
        category: "transit",
        description: "KTX 열차 도착 및 여행 시작.",
        bookingUrl: "https://search.naver.com/search.naver?query=레츠코레일+기차표+예매"
      },
      {
        day: 1,
        id: "b1_transit",
        name: "일반 택시",
        time: "10:30 - 11:00",
        lat: 35.1205,
        lng: 129.0345,
        category: "transit",
        description: "택시 탑승하여 초량 이바구길로 이동.",
        bookingUrl: ""
      },
      {
        day: 1,
        id: "b2",
        name: "초량 1941 & 이바구길",
        time: "11:00 - 12:30",
        lat: 35.1205,
        lng: 129.0345,
        category: "sightseeing",
        description: "부산 전경이 내려다보이는 산복도로의 뉴트로 감성 우유 카페와 모노레일 체험.",
        bookingUrl: "https://search.naver.com/search.naver?query=초량+이바구길"
      },
      {
        day: 1,
        id: "b3",
        name: "부산 원조 돼지국밥 전문점 (점심)",
        time: "12:30 - 13:30",
        lat: 35.1165,
        lng: 129.0401,
        category: "restaurant",
        description: "진한 육수와 야들야들한 수육이 매력적인 부산의 영혼의 동반자 돼지국밥.",
        bookingUrl: "https://search.naver.com/search.naver?query=부산역+돼지국밥+맛집"
      },
      {
        day: 1,
        id: "b3_transit",
        name: "부산 시내버스 (1001번)",
        time: "13:30 - 14:30",
        lat: 35.1601,
        lng: 129.1670,
        category: "transit",
        description: "급행 버스를 이용하여 해운대 방면으로 막힘 없이 시원하게 이동.",
        bookingUrl: ""
      },
      {
        day: 1,
        id: "b4",
        name: "해운대 엘시티 그랜드 엘시티 레지던스 (숙소)",
        time: "15:00 - 16:00",
        lat: 35.1601,
        lng: 129.1670,
        category: "hotel",
        description: "해운대 오션뷰가 한눈에 보이는 럭셔리 레지던스 체크인 및 휴식.",
        bookingUrl: "https://www.agoda.com/search?q=Grand LCT Residence"
      },
      // Day 2
      {
        day: 2,
        id: "b5",
        name: "감천문화마을",
        time: "10:00 - 12:00",
        lat: 35.0975,
        lng: 129.0093,
        category: "sightseeing",
        description: "한국의 산토리니로 불리는 알록달록한 계단식 마을 골목 투어와 어린왕자 포토존.",
        bookingUrl: "https://www.klook.com/ko/search?query=감천문화마을"
      },
      {
        day: 2,
        id: "b6",
        name: "자갈치 시장 & 남포동 비프광장",
        time: "12:30 - 14:30",
        lat: 35.0967,
        lng: 129.0268,
        category: "shopping",
        description: "신선한 회 점심 식사와 씨앗호떡, 납작만두 등 길거리 먹거리 투어.",
        bookingUrl: "https://search.naver.com/search.naver?query=자갈치시장+맛집"
      },
      {
        day: 2,
        id: "b7",
        name: "흰여울문화마을",
        time: "15:00 - 17:00",
        lat: 35.0783,
        lng: 129.0436,
        category: "sightseeing",
        description: "절벽 위 영도 바닷길을 따라 아기자기한 감성 소품샵과 오션뷰 카페 산책.",
        bookingUrl: "https://search.naver.com/search.naver?query=흰여울문화마을"
      },
      {
        day: 2,
        id: "b8",
        name: "광안리 해수욕장 & 민락더마켓",
        time: "18:00 - 20:30",
        lat: 35.1554,
        lng: 129.1185,
        category: "sightseeing",
        description: "광안대교 야경을 보며 수변공원 인근 트렌디한 복합문화공간 민락더마켓 투어 및 저녁식사.",
        bookingUrl: "https://search.naver.com/search.naver?query=민락더마켓+맛집"
      },
      // Day 3
      {
        day: 3,
        id: "b9",
        name: "해운대 블루라인파크 해변열차",
        time: "09:30 - 11:30",
        lat: 35.1586,
        lng: 129.1760,
        category: "sightseeing",
        description: "미포에서 송정까지 탁 트인 동해 바다를 바라보며 달리는 낭만 가득한 철길 열차 투어.",
        bookingUrl: "https://www.klook.com/ko/search?query=해운대블루라인파크"
      },
      {
        day: 3,
        id: "b10",
        name: "기장 해녀촌 전복죽 (점심)",
        time: "12:00 - 13:30",
        lat: 35.2185,
        lng: 129.2272,
        category: "restaurant",
        description: "가마솥에 푹 끓여내어 녹진한 맛이 일품인 기장식 수제 전복죽 정식.",
        bookingUrl: "https://search.naver.com/search.naver?query=기장+해녀촌+전복죽"
      },
      {
        day: 3,
        id: "b11",
        name: "해동용궁사",
        time: "14:00 - 15:30",
        lat: 35.1885,
        lng: 129.2234,
        category: "sightseeing",
        description: "파도가 부서지는 바닷가 바위 위에 세워진 신비롭고 웅장한 수상 법당 사찰.",
        bookingUrl: "https://www.klook.com/ko/search?query=해동용궁사"
      }
    ]
  }
};

const DYNAMIC_PLACES_POOL = {
  "파리": [
    { name: "에펠탑 & 샹드마르스 공원", lat: 48.8584, lng: 2.2945, description: "파리의 영원한 상징. 잔디밭 피크닉과 일몰 전망 감상.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=에펠탑" },
    { name: "루브르 박물관", lat: 48.8606, lng: 2.3376, description: "세계 최대의 박물관에서 모나리자와 비너스상 관람.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=루브르박물관" },
    { name: "샹젤리제 거리 & 개선문", lat: 48.8738, lng: 2.2950, description: "파리 패션의 메카 쇼핑가 산책 및 개선문 전망대 등반.", category: "shopping", bookingUrl: "https://www.klook.com/ko/search?query=파리 개선문" },
    { name: "센강 바토무슈 유람선", lat: 48.8641, lng: 2.3023, description: "센강 물결을 따라 에펠탑, 오르세 등 파리의 랜드마크 야경 크루즈.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=바토무슈" },
    { name: "오르세 미술관", lat: 48.8600, lng: 2.3265, description: "기차역을 개조한 미술관에서 모네, 고흐 등 인상주의 걸작 감상.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=오르세미술관" },
    { name: "몽마르뜨 언덕 & 사크레쾨르 대성당", lat: 48.8867, lng: 2.3431, description: "예술가들의 숨결이 깃든 언덕에서 파리 전경 내려다보기.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=몽마르뜨" },
    { name: "파리 미쉐린 비스트로 (식사)", lat: 48.8540, lng: 2.3450, description: "파리 전통 감성을 느낄 수 있는 오리 가슴살 스테이크와 정통 어니언 스프.", category: "restaurant", bookingUrl: "https://search.naver.com/search.naver?query=파리+맛집+추천" },
    { name: "몽쥬 약국 & 쇼핑", lat: 48.8427, lng: 2.3524, description: "파리 쇼핑 필수 코스. 화장품 대량 구매 및 기념품 쇼핑.", category: "shopping", bookingUrl: "https://search.naver.com/search.naver?query=몽쥬약국" },
    { name: "파리 풀먼 에펠탑 호텔 (숙소)", lat: 48.8559, lng: 2.2926, description: "방 창문 너머로 에펠탑이 손에 잡힐 듯이 보이는 낭만 가득한 호텔.", category: "hotel", bookingUrl: "https://www.agoda.com/search?q=Pullman Paris Tour Eiffel" }
  ],
  "뉴욕": [
    { name: "타임스 스퀘어", lat: 40.7580, lng: -73.9855, description: "잠들지 않는 뉴욕의 심장부. 압도적인 네온사인 광장 체험.", category: "sightseeing", bookingUrl: "https://search.naver.com/search.naver?query=뉴욕+타임스스퀘어" },
    { name: "센트럴 파크", lat: 40.7829, lng: -73.9654, description: "빌딩 숲 한가운데 자리 잡은 세계 최대의 인공 도심 공원 산책.", category: "sightseeing", bookingUrl: "https://search.naver.com/search.naver?query=센트럴파크" },
    { name: "엠파이어 스테이트 빌딩", lat: 40.7484, lng: -73.9857, description: "86층 야외 전망대에서 내려다보는 아르데코 감성의 뉴욕 야경.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=엠파이어스테이트" },
    { name: "자유의 여신상 페리", lat: 40.6892, lng: -74.0445, description: "페리를 타고 허드슨강을 건너 뉴욕의 상징 자유의 여신상 근접 관람.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=자유의여신상" },
    { name: "메트로폴리탄 미술관", lat: 40.7794, lng: -73.9632, description: "인류 역사 5천 년의 예술 유산이 집결된 세계적인 미술관.", category: "sightseeing", bookingUrl: "https://www.klook.com/ko/search?query=메트로폴리탄" },
    { name: "브루클린 브릿지", lat: 40.7061, lng: -73.9969, description: "맨해튼의 스카이라인을 바라보며 상쾌하게 걷는 미국 최고 목조 다리.", category: "sightseeing", bookingUrl: "https://search.naver.com/search.naver?query=브루클린브릿지" },
    { name: "뉴욕 전통 피터루거 스테이크 (저녁)", lat: 40.7099, lng: -73.9625, description: "100년 넘는 전통의 드라이에이징 스테이크의 절정 맛집.", category: "restaurant", bookingUrl: "https://search.naver.com/search.naver?query=피터루거+스테이크+예약" },
    { name: "첼시 마켓 & 로브스터 롤", lat: 40.7420, lng: -74.0062, description: "오래된 과자 공장을 개조한 푸드마켓에서 싱싱한 랍스터와 피자 식사.", category: "restaurant", bookingUrl: "https://search.naver.com/search.naver?query=첼시마켓+랍스터" },
    { name: "맨해튼 아를로 놈 호텔 (숙소)", lat: 40.7470, lng: -73.9890, description: "코리아타운 및 한가운데 위치하여 엠파이어 빌딩 조망이 뛰어난 루프탑 호텔.", category: "hotel", bookingUrl: "https://www.agoda.com/search?q=Arlo NoMad New York" }
  ]
};

// Generic style-based templates for non-pool destinations
const GENERIC_STYLE_TEMPLATES = {
  relaxing: {
    day1: [
      { category: "sightseeing", name: "힐링 숲길 산책로", description: "도심의 복잡함을 벗어나 맑은 공기와 함께하는 차분한 아침 산책." },
      { category: "restaurant", name: "로컬 건강식 전문점", description: "현지 신선한 식재료로 만든 자극적이지 않고 정갈한 웰빙 식사." },
      { category: "cafe", name: "초록 정원 감성 카페", description: "넓은 정원과 온실이 어우러진 평화로운 숲속 뷰 카페." },
      { category: "sightseeing", name: "전망대 & 일몰 포인트", description: "조용히 일몰을 감상하며 하루를 마무리할 수 있는 숨은 조망 스팟." }
    ],
    day2: [
      { category: "sightseeing", name: "전통 스파 & 테라피", description: "여행의 피로를 풀어주는 아늑하고 고요한 힐링 테라피 코스." },
      { category: "restaurant", name: "슬로우 푸드 로컬 맛집", description: "느긋한 시간 속에서 맛을 음미할 수 있는 지역 전통 슬로우 푸드 식당." },
      { category: "cafe", name: "조용한 강변 북카페", description: "잔잔한 물결을 바라보며 독서와 사색을 즐길 수 있는 잔잔한 카페." },
      { category: "sightseeing", name: "야간 호숫가 산책로", description: "은은한 불빛이 흐르는 밤호수 또는 강변길을 따라 걷는 여유로운 야간 산책." }
    ],
    day3: [
      { category: "sightseeing", name: "정갈한 도심 공원 미술관", description: "아름다운 조경과 차분한 예술 작품들을 함께 감상할 수 있는 쉼터." },
      { category: "restaurant", name: "전망 좋은 한적한 레스토랑", description: "탁 트인 뷰를 즐기며 식사할 수 있는 조용한 분위기의 맛집." },
      { category: "shopping", name: "공방 골목 & 소품숍", description: "현지 작가들의 아기자기한 수공예품과 기념품을 파는 아늑한 골목." },
      { category: "cafe", name: "허브티 전문 티하우스", description: "차 한 잔의 여유를 즐기며 조용히 일정을 정리하는 감성 전통 찻집." }
    ]
  },
  active: {
    day1: [
      { category: "sightseeing", name: "대표 랜드마크 타워", description: "도시의 심장이자 빼놓을 수 없는 필수 방문 1순위 광장/타워." },
      { category: "restaurant", name: "웨이팅 핫플 스트리트 푸드", description: "요즘 가장 핫한 트렌디한 골목의 줄 서서 먹는 대표 맛집." },
      { category: "sightseeing", name: "익스트림 어트랙션 파크", description: "이색 체험이나 스릴 넘치는 액티비티를 즐길 수 있는 핫플레이스." },
      { category: "cafe", name: "도심 한복판 루프탑 카페", description: "높은 곳에서 활기찬 도시 전망을 바라보며 마시는 시원한 시그니처 음료." }
    ],
    day2: [
      { category: "sightseeing", name: "문화 역사 탐방 코스", description: "웅장한 건축미와 함께 도시의 역사를 온전히 배울 수 있는 대표 유적지." },
      { category: "restaurant", name: "정통 바비큐/화로구이 전문점", description: "지친 체력을 충전해줄 풍성한 고기 요리와 현지 맥주 한잔." },
      { category: "sightseeing", name: "야경 크루즈 & 선착장", description: "화려하게 반짝이는 도시 불빛들을 물 위에서 감상하는 야간 크루즈 투어." },
      { category: "shopping", name: "대형 복합 쇼핑 센터", description: "브랜드 샵들과 면세점이 밀집된 도시 최대의 쇼핑 구역 투어." }
    ],
    day3: [
      { category: "sightseeing", name: "인스타그래머블 포토 스팟", description: "감각적인 조형물들과 이국적인 배경으로 인생샷을 건질 수 있는 핫플." },
      { category: "restaurant", name: "가성비 로컬 수제버거 맛집", description: "빠르고 맛있게 든든한 한 끼를 해결할 수 있는 현지 수제버거 전문점." },
      { category: "shopping", name: "트렌디 스트리트 패션 마켓", description: "트렌디한 의류와 이색 소품들이 가득한 젊음의 쇼핑 거리." },
      { category: "cafe", name: "스페셜티 드립커피 전문 바", description: "바리스타가 직접 내려주는 최고급 스페셜티 커피와 함께하는 휴식." }
    ]
  },
  foodie: {
    day1: [
      { category: "restaurant", name: "원조 3대 로컬 노포 식당", description: "수십 년 동안 한 자리를 지켜온 전통 깊은 로컬 1등 맛집." },
      { category: "cafe", name: "웨이팅 필수 수제 디저트 베이커리", description: "매일 아침 갓 구워낸 빵과 달콤한 페이스트리로 가득한 베이커리 카페." },
      { category: "restaurant", name: "현지식 숯불구이 전문점", description: "특제 소스와 불맛이 살아있는 로컬 시그니처 숯불구이." },
      { category: "shopping", name: "먹거리 가득한 전통 야시장", description: "다양한 길거리 음식과 간식을 한자리에서 맛볼 수 있는 야시장 탐방." }
    ],
    day2: [
      { category: "restaurant", name: "퓨전 다이닝 & 비스트로", description: "전통 조리법에 현대적 감각을 더한 독창적인 맛의 퓨전 요리점." },
      { category: "cafe", name: "로컬 시그니처 말차 & 티 하우스", description: "현지 찻잎을 사용해 쌉싸름하고 깊은 풍미를 자랑하는 말차 라떼 맛집." },
      { category: "restaurant", name: "고급 해산물 플래터 전문점", description: "산지 직송으로 공수해 신선함이 살아있는 제철 해산물 요리." },
      { category: "cafe", name: "에스프레소 & 감성 아뜰리에", description: "이국적인 인테리어와 시그니처 크림 커피가 훌륭한 카페." }
    ],
    day3: [
      { category: "restaurant", name: "현지인 추천 숨은 해장 국물 요리", description: "아침 혹은 이른 점심으로 속을 시원하고 든든하게 풀어주는 국물 맛집." },
      { category: "shopping", name: "지역 명물 특산품 & 디저트 마켓", description: "선물용 만쥬, 전병 등 귀국 전 반드시 사야 하는 시그니처 디저트 숍." },
      { category: "restaurant", name: "프라이빗 셰프 테이블 디너", description: "눈앞에서 조리 과정을 보며 시각과 미각을 만족시키는 코스 요리." },
      { category: "cafe", name: "전망 좋은 스카이라운지 바/카페", description: "탁 트인 뷰를 바라보며 달콤한 칵테일이나 스페셜 음료로 여행 마무리." }
    ]
  },
  shopping: {
    day1: [
      { category: "shopping", name: "플래그십 스토어 & 디자인 편집숍", description: "가장 핫한 글로벌 브랜드들과 감각적인 인테리어 소품을 모은 편집숍." },
      { category: "cafe", name: "비주얼 예술 감성 카페", description: "음료와 디저트 자체가 하나의 작품 같은, 사진 찍기 완벽한 비주얼 핫플." },
      { category: "shopping", name: "빈티지 소품 & 레트로 골목", description: "유니크한 수입 의류와 세월의 흔적이 묻은 골목길 플리마켓." },
      { category: "restaurant", name: "세련된 브런치 다이닝 카페", description: "화사한 채광 속에서 아보카도 타르틴과 샐러드를 즐길 수 있는 브런치 맛집." }
    ],
    day2: [
      { category: "shopping", name: "럭셔리 부티크 & 명품 거리", description: "세계적인 디자이너 숍과 최고급 백화점이 늘어선 세련된 쇼핑 가." },
      { category: "cafe", name: "이색 테마 플라워 카페", description: "꽃 향기가 가득한 도심 속 정원 컨셉의 힐링 플라워 카페." },
      { category: "shopping", name: "캐릭터 굿즈 & 팝업 스토어", description: "한정판 캐릭터 상품들과 이색 콜라보 굿즈를 만날 수 있는 팝업 존." },
      { category: "restaurant", name: "파스타 & 내추럴 와인 바", description: "트렌디한 감성의 파스타와 깔끔한 내추럴 와인을 곁들이는 저녁 식사." }
    ],
    day3: [
      { category: "shopping", name: "현지 로컬 아울렛 쇼핑 타운", description: "다양한 브랜드를 합리적인 가격에 득템할 수 있는 쇼핑 컴플렉스." },
      { category: "cafe", name: "바다가 한눈에 들어오는 오션뷰 카페", description: "시원한 파도 소리를 들으며 힐링하는 전망대 컨셉의 카페." },
      { category: "shopping", name: "백화점 식품관 데파치카 투어", description: "세계 온갖 고급 디저트와 식료품들이 가득하여 지인 선물을 사기 좋은 곳." },
      { category: "restaurant", name: "감각적인 오픈 키친 스테이크 하우스", description: "트렌디한 인테리어와 훌륭한 굽기의 스테이크로 즐거운 마지막 만찬." }
    ]
  },
  cultural: {
    day1: [
      { category: "sightseeing", name: "국립 중앙 역사 박물관", description: "지역의 기원부터 찬란했던 문명의 흔적을 한눈에 볼 수 있는 박물관." },
      { category: "restaurant", name: "지역 종가집 전통 한정식", description: "대대로 내려오는 전통 조리법으로 정성껏 차려낸 향토 한정식 한 상." },
      { category: "sightseeing", name: "고대 전각 & 역사 궁궐", description: "웅장한 목조 건축과 조경의 조화가 돋보이는 역사적 가치가 높은 고궁." },
      { category: "cafe", name: "전통 양식 한옥 베이커리 카페", description: "서까래와 기와가 멋스러운 전통 가옥 구조에 현대적 카페 감성을 더한 곳." }
    ],
    day2: [
      { category: "sightseeing", name: "세계 유산 산사 & 숲길", description: "유네스코 세계문화유산에 등재된 천년 고찰과 고즈넉한 소나무 숲길 산책." },
      { category: "restaurant", name: "향토 나물 & 산채 보리밥 전문점", description: "절 주변이나 산 밑에서 맛보는 건강하고 신선한 자연 밥상." },
      { category: "sightseeing", name: "전통 문화 예술 전시장", description: "도자기, 공예품, 전통 서예 등 장인들의 숨결을 가까이서 보는 전시 투어." },
      { category: "cafe", name: "수제 쌍화차 & 전통 차 전문점", description: "가마솥에 끓여낸 십전대보탕과 약과를 맛보며 휴식하는 전통 찻집." }
    ],
    day3: [
      { category: "sightseeing", name: "근현대 예술 국립 미술관", description: "근대 미술 거장들의 작품부터 현대 미디어 아트까지 아우르는 복합 문화 공간." },
      { category: "restaurant", name: "로컬 면 요리 명가 (국수/우동)", description: "오랜 세월 동안 이 지역 사람들의 소울푸드가 되어준 국수/우동 맛집." },
      { category: "shopping", name: "고미술품 & 공방 거리 산책", description: "이색적인 골동품과 수제 기념품들을 구경하며 역사 여행을 기념하는 코스." },
      { category: "cafe", name: "레트로 빈티지 로스터리 카페", description: "오래된 건물을 재생하여 만든 클래식 음악이 흐르는 고풍스러운 로스터리." }
    ]
  }
};

const CATEGORY_OFFSETS = {
  sightseeing: { lat: 0.015, lng: -0.010 },
  restaurant: { lat: -0.005, lng: 0.015 },
  cafe: { lat: -0.018, lng: -0.015 },
  shopping: { lat: -0.010, lng: 0.005 },
  hotel: { lat: 0, lng: 0 }
};

const DEFAULT_COORDINATES = {
  "부산": { lat: 35.1796, lng: 129.0756 },
  "제주도": { lat: 33.4996, lng: 126.5312 },
  "제주": { lat: 33.4996, lng: 126.5312 },
  "서울": { lat: 37.5665, lng: 126.9780 },
  "경주": { lat: 35.8562, lng: 129.2132 },
  "도쿄": { lat: 35.6762, lng: 139.6503 },
  "교토": { lat: 35.0116, lng: 135.7681 },
  "오사카": { lat: 34.6937, lng: 135.5023 },
  "파리": { lat: 48.8566, lng: 2.3522 },
  "뉴욕": { lat: 40.7128, lng: -74.0060 },
  "런던": { lat: 51.5074, lng: -0.1278 },
  "방콕": { lat: 13.7563, lng: 100.5018 },
  "다낭": { lat: 16.0544, lng: 108.2022 },
  "싱가포르": { lat: 1.3521, lng: 103.8198 },
  "로마": { lat: 41.9028, lng: 12.4964 },
  "바르셀로나": { lat: 41.3851, lng: 2.1734 }
};

function generateRandomHotelName(destName, dayIndex) {
  const isJapan = /교토|오사카|도쿄|후쿠오카|삿포로|오키나와/i.test(destName);
  const isKorea = /제주|부산|서울|경주|강릉|여수|인천/i.test(destName);

  const prefixJapan = ["미쓰이 가든", "도미 인", "호텔 그레이스리", "소테츠 프레사 인", "료칸 카네이", "교토 야도 Stay", "아파 호텔", "다이와 로이넷 호텔", "호텔 몬테레이"];
  const suffixJapan = ["프리미어", "센트럴", "그랜드", "아넥스", "스파 & 온센", "교토 시조", "도쿄 신주쿠"];

  const prefixKorea = ["신라 Stay", "해비치 리조트", "롯데 시티 호텔", "감성 스테이 쉼", "오션 브리즈", "한옥 게스트하우스 솔", "더 하운드", "어반 포레스트", "브라운 도트", "그랜드 LCT"];
  const suffixKorea = ["호텔", "풀빌라", "펜션", "하우스", "스테이", "레지던스"];

  const prefixGlobal = ["Pullman", "Arlo NoMad", "CitizenM", "Hilton", "Marriott", "Hyatt Regency", "Novotel", "Ibis Styles", "Sofitel", "Mercure"];
  const suffixGlobal = ["Boutique Hotel", "Suites", "Heritage Stay", "City Center", "Resort & Spa", "Luxury Residence", "Executive Lounge"];

  // Pseudo-random seed based on destName length and dayIndex
  const seed = (destName.length + dayIndex * 7) % 10;
  const seed2 = (destName.length * 3 + dayIndex * 13) % 7;

  if (isJapan) {
    const p = prefixJapan[seed % prefixJapan.length];
    const s = suffixJapan[seed2 % suffixJapan.length];
    return `${destName} ${p} ${s} (숙소)`;
  } else if (isKorea) {
    const p = prefixKorea[seed % prefixKorea.length];
    const s = suffixKorea[seed2 % suffixKorea.length];
    return `${destName} ${p} ${s} (숙소)`;
  } else {
    // English/Global
    const p = prefixGlobal[seed % prefixGlobal.length];
    const s = suffixGlobal[seed2 % suffixGlobal.length];
    return `${destName} ${p} ${s} (Accommodation)`;
  }
}

function generateOtaLink(hotelName, index) {
  const otaSites = [
    {
      name: "Agoda",
      urlPattern: (q) => `https://www.agoda.com/search?q=${encodeURIComponent(q)}`
    },
    {
      name: "Booking.com",
      urlPattern: (q) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`
    },
    {
      name: "Hotels.com",
      urlPattern: (q) => `https://kr.hotels.com/search.do?q=${encodeURIComponent(q)}`
    },
    {
      name: "Yanolja",
      urlPattern: (q) => `https://www.yanolja.com/search/${encodeURIComponent(q)}`
    },
    {
      name: "HotelsCombined",
      urlPattern: (q) => `https://www.hotelscombined.co.kr/hotels/${encodeURIComponent(q)}`
    },
    {
      name: "Trivago",
      urlPattern: (q) => `https://www.trivago.co.kr/ko?q=${encodeURIComponent(q)}`
    }
  ];

  // Pick one OTA site based on index deterministically
  const ota = otaSites[index % otaSites.length];
  return ota.urlPattern(hotelName);
}

/**
 * Simulates AI generation of an itinerary based on user input.
 * Returns an array of places with coordinates, descriptions, and categories.
 */
function generateItinerary(destination, days, budget, style) {
  // Normalize destination name
  const destName = destination.trim();
  let baseCoords = { lat: 37.5665, lng: 126.9780 }; // Default Seoul
  
  // Find coordinates
  for (const key in DEFAULT_COORDINATES) {
    if (destName.includes(key) || key.includes(destName)) {
      baseCoords = DEFAULT_COORDINATES[key];
      break;
    }
  }

  // Check if we have dynamic pool for this exact destination
  let pool = null;
  for (const key in DYNAMIC_PLACES_POOL) {
    if (destName.includes(key) || key.includes(destName)) {
      pool = DYNAMIC_PLACES_POOL[key];
      break;
    }
  }

  const generatedPlaces = [];
  const times = [
    "09:30 - 11:30",
    "12:00 - 13:30",
    "14:00 - 16:00",
    "16:30 - 18:00"
  ];

  // Helper to generate a place
  let placeCounter = 1;

  for (let day = 1; day <= days; day++) {
    // Hotel recommendation per day (staying at same or new hotel)
    // Add transit/first sightseeing
    let hotelName = generateRandomHotelName(destName, day);
    let hotelLat = baseCoords.lat;
    let hotelLng = baseCoords.lng;
    let hotelBookingUrl = "";

    if (pool) {
      const poolHotel = pool.find(p => p.category === "hotel");
      if (poolHotel) {
        hotelName = poolHotel.name;
        hotelLat = poolHotel.lat;
        hotelLng = poolHotel.lng;
        // Varied booking URL instead of hardcoded Agoda
        poolHotel.bookingUrl = generateOtaLink(hotelName, day);
        hotelBookingUrl = poolHotel.bookingUrl;
      }
    }
    if (!hotelBookingUrl) {
      hotelBookingUrl = generateOtaLink(hotelName, day);
    }

    // Filter non-hotel places from pool beforehand if pool is present
    const nonHotelPool = pool ? pool.filter(p => p.category !== "hotel") : null;

    // Get style template if pool is not present
    const styleTemplate = !pool ? (GENERIC_STYLE_TEMPLATES[style] || GENERIC_STYLE_TEMPLATES.relaxing) : null;

    // Generate spots for the day
    for (let slot = 0; slot < 4; slot++) {
      let place = {};
      const time = times[slot];

      if (pool && nonHotelPool && nonHotelPool.length > 0) {
        // Pick places from the predefined city pool matching slot (avoid day to day duplicates)
        const index = ((day - 1) * 4 + slot) % nonHotelPool.length;
        const poolPlace = nonHotelPool[index];
        
        place = {
          day: day,
          id: `gen-${placeCounter++}`,
          name: poolPlace.name,
          time: time,
          lat: poolPlace.lat,
          lng: poolPlace.lng,
          category: poolPlace.category,
          description: poolPlace.description,
          bookingUrl: poolPlace.bookingUrl
        };
      } else if (styleTemplate) {
        // Use style template based on day and slot
        const dayKey = 'day' + (((day - 1) % 3) + 1);
        const spotConfig = styleTemplate[dayKey][slot % 4];
        
        const baseOffset = CATEGORY_OFFSETS[spotConfig.category] || { lat: 0, lng: 0 };
        const offsetLat = baseOffset.lat + (Math.random() - 0.5) * 0.005;
        const offsetLng = baseOffset.lng + (Math.random() - 0.5) * 0.005;
        
        const customName = `${destName} ${spotConfig.name}`;
        const customDesc = spotConfig.description;
        
        let booking = "";
        if (spotConfig.category === "hotel") {
          booking = generateOtaLink(customName, day);
        } else {
          booking = `https://search.naver.com/search.naver?query=${encodeURIComponent(destName + " " + customName)}`;
        }

        place = {
          day: day,
          id: `gen-${placeCounter++}`,
          name: customName,
          time: time,
          lat: baseCoords.lat + offsetLat,
          lng: baseCoords.lng + offsetLng,
          category: spotConfig.category,
          description: customDesc,
          bookingUrl: booking
        };
      }

      generatedPlaces.push(place);
    }

    // Add Hotel check-in / return at end of day
    const hotelBooking = hotelBookingUrl;
    generatedPlaces.push({
      day: day,
      id: `gen-${placeCounter++}`,
      name: hotelName,
      time: "20:30 ~",
      lat: hotelLat,
      lng: hotelLng,
      category: "hotel",
      description: "하루의 일정을 정리하고 휴식을 취하는 공간. 안락한 객실 제공.",
      bookingUrl: hotelBooking
    });
  }

  return generatedPlaces;
}

// Export values so they are globally accessible in the browser
window.PREDEFINED_TEMPLATES = PREDEFINED_TEMPLATES;
window.generateItinerary = generateItinerary;
