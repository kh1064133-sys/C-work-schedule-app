// Google ML Kit을 사용한 OCR(텍스트 인식) 서비스
// 이미지에서 텍스트를 읽어서 금액과 메뉴이름을 분리합니다

import 'dart:io'; // 파일(File) 클래스를 사용하기 위해 가져옴
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart'; // ML Kit OCR 패키지

/// 인식된 메뉴 항목 하나를 담는 클래스
/// 예: "Pad Thai  $12.99" → name: "Pad Thai", price: 12.99, currency: "$"
class MenuItem {
  final String name; // 메뉴 이름 (예: "Pad Thai")
  final double? price; // 가격 숫자 (예: 12.99), 없으면 null
  final String? currency; // 통화 기호 (예: "$"), 없으면 null
  final String rawText; // 원본 텍스트 (OCR이 읽은 그대로)

  // 생성자: 각 필드를 받아서 객체를 만듦
  MenuItem({
    required this.name, // 필수: 메뉴 이름
    this.price, // 선택: 가격
    this.currency, // 선택: 통화 기호
    required this.rawText, // 필수: 원본 텍스트
  });

  /// 가격이 있는 항목인지 확인하는 편의 메서드
  bool get hasPrice => price != null; // price가 null이 아니면 true

  /// 디버깅용 문자열 표현
  @override
  String toString() {
    // 가격이 있으면 "메뉴이름: $12.99", 없으면 "메뉴이름: 가격없음"
    if (hasPrice) {
      return '$name: $currency$price'; // 예: "Pad Thai: $12.99"
    }
    return '$name: 가격없음'; // 예: "Special Menu: 가격없음"
  }
}

/// OCR 전체 결과를 담는 클래스
class OcrResult {
  final List<MenuItem> menuItems; // 인식된 메뉴 항목 목록
  final String fullText; // 전체 인식 텍스트 (디버깅용)
  final bool success; // 인식 성공 여부
  final String? errorMessage; // 에러 메시지 (실패 시)

  // 생성자
  OcrResult({
    required this.menuItems, // 필수: 메뉴 항목 리스트
    required this.fullText, // 필수: 전체 텍스트
    this.success = true, // 기본값: 성공(true)
    this.errorMessage, // 선택: 에러 메시지
  });

  /// 에러 발생 시 사용하는 팩토리 생성자
  /// OcrResult.error("에러메시지") 로 간편하게 에러 결과 생성
  factory OcrResult.error(String message) {
    return OcrResult(
      menuItems: [], // 빈 리스트 (인식된 것 없음)
      fullText: '', // 빈 텍스트
      success: false, // 실패
      errorMessage: message, // 에러 메시지 저장
    );
  }
}

/// OCR 서비스 클래스
/// 이미지 파일을 받아서 텍스트를 인식하고, 금액/메뉴이름을 분리합니다
class OcrService {
  // ML Kit 텍스트 인식기 (라틴 문자 기반 - 영어, 유럽어 등)
  // 한국어/일본어/중국어는 별도 스크립트 필요
  final _textRecognizer = TextRecognizer(
    script: TextRecognitionScript.latin, // 라틴 문자 인식 모드
  );

  /// 금액 패턴을 찾기 위한 정규식 (RegExp)
  /// 지원하는 패턴 예시:
  ///   접두 기호: $12.99, €15.00, ¥1500, £25, ₩15000, ฿120, ₫50000, ₱299, ₹450
  ///   접미 기호: 12.99$, 15,000원
  ///   코드 접두: USD 12.99, EUR 15.00
  ///   콤마 포함: $1,234.56, ¥12,500
  ///   숫자만 (큰 수): 15,000  25,000
  static final _pricePattern = RegExp(
    r'(?:'
    // ── 그룹1: 통화기호가 앞에 오는 패턴 ──
    // 예: $12.99, €15, ¥1,500, ₩15000, ฿120
    r'([$€¥£₩฿₫₱₹])\s*'          // 캡처그룹1: 통화 기호
    r'(\d{1,3}(?:[,]\d{3})*'       // 캡처그룹2 시작: 정수부 (1~3자리 + 콤마 반복)
    r'(?:\.\d{1,2})?)'             // 캡처그룹2 끝: 소수점 (선택, .00~.99)
    r'|'
    // ── 그룹2: 통화코드가 앞에 오는 패턴 ──
    // 예: USD 25.00, EUR 12.50, THB 120
    r'(USD|EUR|JPY|GBP|KRW|THB|VND|CNY|PHP|TWD|SGD|MYR|IDR|AUD|CAD|CHF|HKD|INR)\s*'  // 캡처그룹3: 통화 코드
    r'(\d{1,3}(?:[,]\d{3})*'       // 캡처그룹4 시작: 정수부
    r'(?:\.\d{1,2})?)'             // 캡처그룹4 끝: 소수점 (선택)
    r'|'
    // ── 그룹3: 통화기호가 뒤에 오는 패턴 ──
    // 예: 15,000원, 1200円, 100元, 12.99$
    r'(\d{1,3}(?:[,]\d{3})*'       // 캡처그룹5 시작: 정수부
    r'(?:\.\d{1,2})?)\s*'          // 캡처그룹5 끝: 소수점 (선택)
    r'([$€¥£₩฿₫₱₹]|원|円|元|바트)' // 캡처그룹6: 통화 기호/텍스트
    r'|'
    // ── 그룹4: 콤마로 구분된 큰 숫자 (통화기호 없음) ──
    // 예: 15,000  25,000 (메뉴판에서 흔한 패턴)
    r'(?:^|\s)(\d{1,3}(?:,\d{3})+)(?:\s|$)' // 캡처그룹7: 콤마 포함 큰 숫자
    r')',
    caseSensitive: false, // 대소문자 구분 안 함 (usd, USD 모두 인식)
  );

  /// 통화 기호/텍스트를 표준 통화 기호로 변환하는 맵
  static const _currencyMap = {
    '원': '₩',    // 한국 원 → ₩
    '円': '¥',    // 일본 엔 → ¥
    '元': '¥',    // 중국 위안 → ¥
    '바트': '฿',  // 태국 바트 → ฿
    'USD': '\$',  // 미국 달러
    'EUR': '€',   // 유로
    'JPY': '¥',   // 일본 엔
    'GBP': '£',   // 영국 파운드
    'KRW': '₩',   // 한국 원
    'THB': '฿',   // 태국 바트
    'VND': '₫',   // 베트남 동
    'CNY': '¥',   // 중국 위안
    'PHP': '₱',   // 필리핀 페소
    'TWD': '\$',  // 대만 달러
    'SGD': '\$',  // 싱가포르 달러
    'MYR': 'RM',  // 말레이시아 링깃
    'IDR': 'Rp',  // 인도네시아 루피아
    'AUD': '\$',  // 호주 달러
    'CAD': '\$',  // 캐나다 달러
    'CHF': 'CHF', // 스위스 프랑
    'HKD': '\$',  // 홍콩 달러
    'INR': '₹',   // 인도 루피
  };

  /// ★ 핵심 메서드: 이미지 파일에서 텍스트를 인식합니다
  /// [imageFile] - 촬영하거나 갤러리에서 선택한 이미지 파일
  /// 반환: OcrResult (메뉴 항목 목록 + 전체 텍스트)
  Future<OcrResult> recognizeText(File imageFile) async {
    try {
      // 1단계: 파일이 존재하는지 확인
      if (!await imageFile.exists()) {
        // 파일이 없으면 에러 반환
        return OcrResult.error('이미지 파일을 찾을 수 없습니다.');
      }

      // 2단계: ML Kit이 읽을 수 있는 InputImage 객체 생성
      final inputImage = InputImage.fromFile(imageFile);

      // 3단계: ML Kit으로 텍스트 인식 실행 (비동기 - 시간이 걸림)
      final recognizedText = await _textRecognizer.processImage(inputImage);

      // 4단계: 인식된 전체 텍스트 추출
      final fullText = recognizedText.text; // 모든 텍스트가 하나의 문자열로

      // 5단계: 텍스트가 비어있으면 빈 결과 반환
      if (fullText.trim().isEmpty) {
        return OcrResult(
          menuItems: [], // 인식된 메뉴 없음
          fullText: '', // 빈 텍스트
        );
      }

      // 6단계: 인식된 텍스트를 블록 → 라인 단위로 분석
      // ML Kit은 텍스트를 블록(block) > 라인(line) > 단어(element) 계층으로 반환
      final menuItems = <MenuItem>[]; // 결과를 담을 빈 리스트

      for (final block in recognizedText.blocks) {
        // 각 블록(문단 단위) 순회
        for (final line in block.lines) {
          // 각 라인(한 줄) 순회
          final lineText = line.text.trim(); // 앞뒤 공백 제거

          // 빈 줄이면 건너뜀
          if (lineText.isEmpty) continue;

          // 7단계: 이 줄에서 금액 패턴 찾기
          final menuItem = _parseLine(lineText);
          // 결과를 리스트에 추가
          menuItems.add(menuItem);
        }
      }

      // 8단계: 최종 결과 반환
      return OcrResult(
        menuItems: menuItems, // 파싱된 메뉴 항목들
        fullText: fullText, // 전체 원본 텍스트
      );
    } catch (e) {
      // 예외 발생 시 에러 결과 반환
      return OcrResult.error('텍스트 인식 중 오류 발생: $e');
    }
  }

  /// 한 줄의 텍스트를 분석하여 MenuItem으로 변환
  /// 예: "Pad Thai  $12.99" → MenuItem(name: "Pad Thai", price: 12.99, currency: "$")
  MenuItem _parseLine(String lineText) {
    // 금액 패턴 매칭 시도
    final match = _pricePattern.firstMatch(lineText);

    // 금액 패턴을 찾지 못한 경우 → 메뉴 이름만 있는 항목
    if (match == null) {
      return MenuItem(
        name: lineText, // 전체 텍스트를 메뉴 이름으로
        rawText: lineText, // 원본 텍스트 저장
      );
    }

    // 금액과 통화 기호 추출
    double? price; // 추출한 가격
    String? currency; // 추출한 통화 기호

    if (match.group(1) != null && match.group(2) != null) {
      // ── 패턴1: 기호가 앞에 (예: $12.99) ──
      currency = match.group(1)!; // 통화 기호 (예: $)
      price = _parseNumber(match.group(2)!); // 숫자 파싱 (예: 12.99)
    } else if (match.group(3) != null && match.group(4) != null) {
      // ── 패턴2: 코드가 앞에 (예: USD 25.00) ──
      final code = match.group(3)!.toUpperCase(); // 통화 코드 (예: USD)
      currency = _currencyMap[code] ?? code; // 코드를 기호로 변환
      price = _parseNumber(match.group(4)!); // 숫자 파싱
    } else if (match.group(5) != null && match.group(6) != null) {
      // ── 패턴3: 기호가 뒤에 (예: 15,000원) ──
      final suffix = match.group(6)!; // 통화 텍스트 (예: 원)
      currency = _currencyMap[suffix] ?? suffix; // 텍스트를 기호로 변환
      price = _parseNumber(match.group(5)!); // 숫자 파싱
    } else if (match.group(7) != null) {
      // ── 패턴4: 콤마 포함 큰 숫자 (예: 15,000) ──
      price = _parseNumber(match.group(7)!); // 숫자 파싱
      currency = null; // 통화 기호 없음 (나중에 기본 통화 적용)
    }

    // 금액 부분을 텍스트에서 제거하면 메뉴 이름이 남음
    // 예: "Pad Thai  $12.99" → "Pad Thai"
    final menuName = lineText
        .replaceAll(match.group(0)!, '') // 금액 부분 제거
        .replaceAll(RegExp(r'\s{2,}'), ' ') // 연속 공백을 하나로
        .replaceAll(RegExp(r'^[\s\.\-_:·…]+|[\s\.\-_:·…]+$'), '') // 앞뒤 구분자 제거
        .trim(); // 앞뒤 공백 제거

    return MenuItem(
      name: menuName.isNotEmpty ? menuName : '(메뉴이름 없음)', // 이름이 비면 기본값
      price: price, // 추출한 가격
      currency: currency, // 추출한 통화 기호
      rawText: lineText, // 원본 텍스트
    );
  }

  /// 문자열 숫자를 double로 변환
  /// 콤마 제거 후 파싱 (예: "1,234.56" → 1234.56)
  double? _parseNumber(String str) {
    // 콤마 제거
    final cleaned = str.replaceAll(',', '');
    // double로 변환 시도, 실패하면 null 반환
    return double.tryParse(cleaned);
  }

  /// 리소스 정리 메서드
  /// 앱 종료 시 또는 더 이상 OCR이 필요 없을 때 호출
  /// ML Kit 인식기가 사용하는 메모리를 해제합니다
  void dispose() {
    _textRecognizer.close(); // 텍스트 인식기 종료
  }
}
