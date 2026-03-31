// 환율 변환 서비스
// 무료 API에서 실시간 환율을 가져오고, 외국 금액을 원화(KRW)로 변환합니다
// 오프라인일 때는 마지막으로 저장된 환율을 사용합니다

import 'dart:convert'; // JSON 파싱용
import 'package:http/http.dart' as http; // HTTP 요청용
import 'package:shared_preferences/shared_preferences.dart'; // 로컬 저장소 (오프라인 캐시)

/// 환율 변환 결과를 담는 클래스
class ConversionResult {
  final double originalAmount; // 원래 금액 (예: 12.99)
  final String fromCurrency; // 원래 통화 (예: "USD")
  final double convertedAmount; // 변환된 금액 (예: 17,287)
  final String toCurrency; // 변환 대상 통화 (예: "KRW")
  final double exchangeRate; // 적용된 환율 (예: 1330.5)
  final bool isOfflineRate; // 오프라인 캐시 환율 사용 여부
  final bool success; // 변환 성공 여부
  final String? errorMessage; // 에러 메시지

  // 생성자
  ConversionResult({
    required this.originalAmount,
    required this.fromCurrency,
    required this.convertedAmount,
    required this.toCurrency,
    required this.exchangeRate,
    this.isOfflineRate = false,
    this.success = true,
    this.errorMessage,
  });

  /// 에러 발생 시 간편 생성
  factory ConversionResult.error(
    double amount,
    String from,
    String message,
  ) {
    return ConversionResult(
      originalAmount: amount,
      fromCurrency: from,
      convertedAmount: 0, // 변환 실패
      toCurrency: 'KRW',
      exchangeRate: 0,
      success: false,
      errorMessage: message,
    );
  }
}

/// 환율 서비스 클래스
/// 실시간 환율 조회 + 오프라인 캐시 + 통화 변환
class ExchangeRateService {
  // ── 설정 상수 ──

  // 무료 환율 API URL (open.er-api.com - 무료, 회원가입 불필요)
  static const _apiBaseUrl = 'https://open.er-api.com/v6/latest';

  // 로컬 저장소 키 (캐시용)
  static const _cacheKey = 'cached_exchange_rates'; // 환율 데이터
  static const _cacheTimeKey = 'cached_exchange_rates_time'; // 캐시 시각

  // 캐시 유효 시간: 1시간 (밀리초)
  static const _cacheDuration = 60 * 60 * 1000;

  // ── 상태 변수 ──

  // 현재 메모리에 로드된 환율 데이터
  // 키: 통화 코드 (예: "USD"), 값: 환율 (USD 기준)
  Map<String, double>? _rates;

  // 환율 기준 통화 (API에서 가져온 기준)
  String _baseCurrency = 'USD';

  // 마지막 환율 업데이트 시각
  DateTime? _lastUpdated;

  // 오프라인 캐시 사용 중인지 여부
  bool _isUsingCache = false;

  /// 통화 기호 → 통화 코드 변환 맵
  /// OCR로 인식한 기호를 통화 코드로 바꿀 때 사용
  static const _symbolToCode = {
    '\$': 'USD', // 달러 기호 → 미국 달러 (기본)
    '€': 'EUR', // 유로 기호 → 유로
    '¥': 'JPY', // 엔/위안 기호 → 일본 엔 (기본)
    '£': 'GBP', // 파운드 기호 → 영국 파운드
    '₩': 'KRW', // 원 기호 → 한국 원
    '฿': 'THB', // 바트 기호 → 태국 바트
    '₫': 'VND', // 동 기호 → 베트남 동
    '₱': 'PHP', // 페소 기호 → 필리핀 페소
    '₹': 'INR', // 루피 기호 → 인도 루피
  };

  /// 지원하는 통화 목록 (코드 → 한글 이름)
  static const supportedCurrencies = {
    'USD': '미국 달러',
    'EUR': '유로',
    'JPY': '일본 엔',
    'GBP': '영국 파운드',
    'KRW': '한국 원',
    'THB': '태국 바트',
    'CNY': '중국 위안',
    'VND': '베트남 동',
    'PHP': '필리핀 페소',
    'TWD': '대만 달러',
    'SGD': '싱가포르 달러',
    'MYR': '말레이시아 링깃',
    'IDR': '인도네시아 루피아',
    'AUD': '호주 달러',
    'CAD': '캐나다 달러',
    'CHF': '스위스 프랑',
    'HKD': '홍콩 달러',
    'INR': '인도 루피',
  };

  /// ★ 핵심 메서드: 외국 금액을 원화(KRW)로 변환
  /// [amount] - 변환할 금액 (예: 12.99)
  /// [fromCurrency] - 원래 통화 코드 (예: "USD") 또는 기호 (예: "$")
  Future<ConversionResult> convertToKRW(
    double amount,
    String fromCurrency,
  ) async {
    try {
      // 통화 기호가 들어왔으면 코드로 변환 (예: "$" → "USD")
      final currencyCode = _resolveCode(fromCurrency);

      // 이미 원화면 변환 불필요
      if (currencyCode == 'KRW') {
        return ConversionResult(
          originalAmount: amount,
          fromCurrency: 'KRW',
          convertedAmount: amount, // 그대로
          toCurrency: 'KRW',
          exchangeRate: 1.0, // 1:1
        );
      }

      // 환율 데이터가 없거나 오래됐으면 새로 가져오기
      if (_rates == null || _isExpired()) {
        await refreshRates(); // 환율 갱신
      }

      // 환율 데이터가 여전히 없으면 에러
      if (_rates == null) {
        return ConversionResult.error(
          amount,
          currencyCode,
          '환율 정보를 가져올 수 없습니다.',
        );
      }

      // 해당 통화의 환율 찾기
      final fromRate = _rates![currencyCode]; // 출발 통화 환율
      final krwRate = _rates!['KRW']; // 원화 환율

      // 통화 코드가 없으면 에러
      if (fromRate == null) {
        return ConversionResult.error(
          amount,
          currencyCode,
          '지원하지 않는 통화입니다: $currencyCode',
        );
      }

      // 원화 환율이 없으면 에러
      if (krwRate == null) {
        return ConversionResult.error(
          amount,
          currencyCode,
          '원화(KRW) 환율 정보가 없습니다.',
        );
      }

      // 환율 계산: from → USD(기준) → KRW
      // 예: $12.99 → USD 기준이므로 fromRate=1.0, krwRate=1330.5
      // 계산: 12.99 / 1.0 * 1330.5 = 17,283.40
      final amountInBase = amount / fromRate; // 기준 통화(USD)로 변환
      final convertedAmount = amountInBase * krwRate; // KRW로 변환

      // 적용 환율 계산 (1 fromCurrency = ? KRW)
      final effectiveRate = krwRate / fromRate;

      return ConversionResult(
        originalAmount: amount,
        fromCurrency: currencyCode,
        convertedAmount: convertedAmount,
        toCurrency: 'KRW',
        exchangeRate: effectiveRate,
        isOfflineRate: _isUsingCache, // 오프라인 캐시 사용 여부
      );
    } catch (e) {
      return ConversionResult.error(
        amount,
        fromCurrency,
        '환율 변환 중 오류 발생: $e',
      );
    }
  }

  /// 환율 데이터를 API에서 새로 가져오기
  /// 인터넷 연결 실패 시 로컬 캐시에서 로드
  Future<bool> refreshRates() async {
    try {
      // API 호출 (USD 기준 환율)
      final response = await http
          .get(Uri.parse('$_apiBaseUrl/USD'))
          .timeout(const Duration(seconds: 10)); // 10초 타임아웃

      // 응답 성공 확인
      if (response.statusCode == 200) {
        // JSON 파싱
        final data = json.decode(response.body);

        // API 응답에서 환율 맵 추출
        final rates = data['rates'] as Map<String, dynamic>;

        // double로 변환하여 저장
        _rates = rates.map(
          (key, value) => MapEntry(key, (value as num).toDouble()),
        );

        _baseCurrency = 'USD'; // 기준 통화
        _lastUpdated = DateTime.now(); // 업데이트 시각
        _isUsingCache = false; // 실시간 데이터 사용 중

        // 로컬에 캐시 저장 (오프라인 대비)
        await _saveToCache();

        return true; // 성공
      } else {
        // API 에러 → 캐시에서 로드 시도
        return await _loadFromCache();
      }
    } catch (e) {
      // 네트워크 에러 (오프라인 등) → 캐시에서 로드 시도
      return await _loadFromCache();
    }
  }

  /// 통화 기호를 통화 코드로 변환
  /// 이미 코드면 그대로 반환
  /// 예: "$" → "USD", "EUR" → "EUR"
  String _resolveCode(String input) {
    // 앞뒤 공백 제거
    final trimmed = input.trim();

    // 이미 3글자 통화 코드면 대문자로 반환
    if (trimmed.length == 3 && RegExp(r'^[A-Za-z]{3}$').hasMatch(trimmed)) {
      return trimmed.toUpperCase();
    }

    // 기호 → 코드 변환 시도
    final code = _symbolToCode[trimmed];
    if (code != null) return code;

    // 매칭 안 되면 입력값을 대문자로 반환
    return trimmed.toUpperCase();
  }

  /// 캐시가 만료됐는지 확인
  /// 1시간 이상 지났으면 만료로 판단
  bool _isExpired() {
    if (_lastUpdated == null) return true; // 업데이트 기록 없음
    final elapsed = DateTime.now().difference(_lastUpdated!).inMilliseconds;
    return elapsed > _cacheDuration; // 1시간 초과 여부
  }

  /// 환율 데이터를 로컬 저장소에 캐시
  Future<void> _saveToCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // 환율 맵을 JSON 문자열로 변환하여 저장
      final ratesJson = json.encode(_rates);
      await prefs.setString(_cacheKey, ratesJson);

      // 캐시 시각 저장 (밀리초 타임스탬프)
      await prefs.setInt(
        _cacheTimeKey,
        DateTime.now().millisecondsSinceEpoch,
      );
    } catch (e) {
      // 저장 실패는 무시 (치명적이지 않음)
    }
  }

  /// 로컬 저장소에서 캐시된 환율 로드
  /// 오프라인이거나 API 실패 시 사용
  Future<bool> _loadFromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // 저장된 환율 데이터 읽기
      final ratesJson = prefs.getString(_cacheKey);
      if (ratesJson == null) return false; // 캐시 없음

      // JSON → Map으로 변환
      final decoded = json.decode(ratesJson) as Map<String, dynamic>;
      _rates = decoded.map(
        (key, value) => MapEntry(key, (value as num).toDouble()),
      );

      // 캐시 시각 읽기
      final cachedTime = prefs.getInt(_cacheTimeKey);
      if (cachedTime != null) {
        _lastUpdated = DateTime.fromMillisecondsSinceEpoch(cachedTime);
      }

      _baseCurrency = 'USD';
      _isUsingCache = true; // 캐시 사용 중 표시

      return true; // 캐시 로드 성공
    } catch (e) {
      return false; // 캐시 로드 실패
    }
  }

  /// 현재 환율 정보 가져오기 (디버깅/표시용)
  /// [currencyCode] - 조회할 통화 코드 (예: "USD")
  /// 반환: 1 currencyCode = ? KRW
  double? getRate(String currencyCode) {
    if (_rates == null) return null; // 데이터 없음

    final code = _resolveCode(currencyCode);
    final fromRate = _rates![code];
    final krwRate = _rates!['KRW'];

    if (fromRate == null || krwRate == null) return null;

    // 1 fromCurrency = ? KRW
    return krwRate / fromRate;
  }

  /// 환율 데이터가 로드되어 있는지 확인
  bool get hasRates => _rates != null;

  /// 오프라인 캐시 사용 중인지 확인
  bool get isUsingCachedRates => _isUsingCache;

  /// 마지막 업데이트 시각
  DateTime? get lastUpdated => _lastUpdated;

  /// 원화 금액을 보기 좋게 포맷팅
  /// 예: 17283.4 → "₩17,283"
  static String formatKRW(double amount) {
    // 원화는 소수점 없이 표시
    final rounded = amount.round();
    // 3자리마다 콤마 추가
    final formatted = rounded.toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
      (match) => '${match[1]},',
    );
    return '₩$formatted'; // 원 기호 추가
  }
}
