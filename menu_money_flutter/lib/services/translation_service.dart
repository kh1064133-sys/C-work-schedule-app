// Google ML Kit 온디바이스 번역 서비스
// 외국어 메뉴 이름을 한국어로 번역합니다 (오프라인 가능)

import 'package:google_mlkit_translation/google_mlkit_translation.dart'; // ML Kit 번역 패키지

/// 번역 결과를 담는 클래스
class TranslationResult {
  final String originalText; // 원본 텍스트 (예: "Pad Thai")
  final String translatedText; // 번역된 텍스트 (예: "팟타이")
  final String detectedLanguage; // 감지된 언어 (예: "en")
  final bool success; // 번역 성공 여부
  final String? errorMessage; // 에러 메시지 (실패 시)

  // 생성자
  TranslationResult({
    required this.originalText, // 필수: 원본 텍스트
    required this.translatedText, // 필수: 번역 결과
    this.detectedLanguage = 'unknown', // 기본값: 알 수 없음
    this.success = true, // 기본값: 성공
    this.errorMessage, // 선택: 에러 메시지
  });

  /// 에러 발생 시 간편 생성
  factory TranslationResult.error(String original, String message) {
    return TranslationResult(
      originalText: original, // 원본 텍스트 보존
      translatedText: original, // 번역 실패 시 원본 그대로 반환
      success: false, // 실패 표시
      errorMessage: message, // 에러 메시지
    );
  }
}

/// 번역 서비스 클래스
/// ML Kit 온디바이스 번역을 사용하여 외국어 → 한국어 번역
class TranslationService {
  // 언어별 번역기를 캐시 (같은 언어 번역기를 매번 새로 만들지 않기 위해)
  // 키: 소스 언어 코드 (예: "en"), 값: 번역기 객체
  final Map<String, OnDeviceTranslator> _translators = {};

  // 모델 다운로드 관리자 (번역에 필요한 언어 모델을 다운로드)
  final _modelManager = OnDeviceTranslatorModelManager();

  /// 지원하는 언어 목록
  /// ML Kit TranslateLanguage 코드 → 사람이 읽을 수 있는 이름
  static const supportedLanguages = {
    'en': '영어',     // English
    'ja': '일본어',   // Japanese
    'zh': '중국어',   // Chinese
    'th': '태국어',   // Thai
    'vi': '베트남어', // Vietnamese
    'es': '스페인어', // Spanish
    'fr': '프랑스어', // French
    'de': '독일어',   // German
    'it': '이탈리아어', // Italian
    'pt': '포르투갈어', // Portuguese
    'id': '인도네시아어', // Indonesian
    'ms': '말레이어', // Malay
    'tl': '필리핀어', // Tagalog
  };

  /// ★ 핵심 메서드: 텍스트를 한국어로 번역
  /// [text] - 번역할 외국어 텍스트
  /// [sourceLanguage] - 소스 언어 코드 (null이면 자동 감지)
  ///   예: 'en'(영어), 'ja'(일본어), 'zh'(중국어), 'th'(태국어)
  Future<TranslationResult> translateToKorean(
    String text, {
    String? sourceLanguage, // 소스 언어 (null = 자동 감지)
  }) async {
    try {
      // 빈 텍스트면 그대로 반환
      if (text.trim().isEmpty) {
        return TranslationResult(
          originalText: text,
          translatedText: text,
        );
      }

      // 소스 언어가 지정되지 않았으면 자동 감지
      final detectedLang = sourceLanguage ?? _detectLanguage(text);

      // 이미 한국어면 번역 불필요
      if (detectedLang == 'ko') {
        return TranslationResult(
          originalText: text,
          translatedText: text, // 그대로 반환
          detectedLanguage: 'ko',
        );
      }

      // 해당 언어의 번역기 가져오기 (없으면 새로 생성)
      final translator = await _getTranslator(detectedLang);

      // 번역기가 null이면 지원하지 않는 언어
      if (translator == null) {
        return TranslationResult.error(
          text,
          '지원하지 않는 언어입니다: $detectedLang',
        );
      }

      // 번역 실행 (비동기 - 시간이 걸릴 수 있음)
      final translated = await translator.translateText(text);

      // 결과 반환
      return TranslationResult(
        originalText: text, // 원본
        translatedText: translated, // 번역 결과
        detectedLanguage: detectedLang, // 감지/지정된 언어
      );
    } catch (e) {
      // 번역 중 에러 발생
      return TranslationResult.error(text, '번역 중 오류 발생: $e');
    }
  }

  /// 여러 텍스트를 한꺼번에 번역 (메뉴 항목 리스트용)
  /// [texts] - 번역할 텍스트 목록
  /// [sourceLanguage] - 소스 언어 코드 (null이면 자동 감지)
  Future<List<TranslationResult>> translateAll(
    List<String> texts, {
    String? sourceLanguage,
  }) async {
    // 각 텍스트를 순서대로 번역하고 결과 리스트로 반환
    final results = <TranslationResult>[]; // 결과 담을 빈 리스트

    for (final text in texts) {
      // 각 텍스트를 번역
      final result = await translateToKorean(
        text,
        sourceLanguage: sourceLanguage,
      );
      results.add(result); // 결과 추가
    }

    return results; // 전체 결과 반환
  }

  /// 번역 모델 다운로드 (특정 언어)
  /// 오프라인에서 사용하려면 미리 다운로드 필요
  /// [languageCode] - 다운로드할 언어 코드 (예: 'en', 'ja')
  Future<bool> downloadModel(String languageCode) async {
    try {
      // ML Kit의 BCP-47 언어 태그로 변환
      final bcpCode = _toBcp47(languageCode);
      if (bcpCode == null) return false; // 지원하지 않는 언어

      // 모델 다운로드 시작 (WiFi 필요, 수 MB 크기)
      final result = await _modelManager.downloadModel(bcpCode);
      return result; // 성공 여부 반환
    } catch (e) {
      return false; // 실패
    }
  }

  /// 번역 모델이 이미 다운로드되어 있는지 확인
  /// [languageCode] - 확인할 언어 코드
  Future<bool> isModelDownloaded(String languageCode) async {
    try {
      final bcpCode = _toBcp47(languageCode);
      if (bcpCode == null) return false;

      // 모델 존재 여부 확인
      return await _modelManager.isModelDownloaded(bcpCode);
    } catch (e) {
      return false;
    }
  }

  /// 번역 모델 삭제 (저장공간 확보용)
  /// [languageCode] - 삭제할 언어 코드
  Future<bool> deleteModel(String languageCode) async {
    try {
      final bcpCode = _toBcp47(languageCode);
      if (bcpCode == null) return false;

      return await _modelManager.deleteModel(bcpCode);
    } catch (e) {
      return false;
    }
  }

  /// 해당 언어의 번역기를 가져오거나 새로 생성
  /// 한 번 만든 번역기는 캐시에 저장하여 재사용
  Future<OnDeviceTranslator?> _getTranslator(String languageCode) async {
    // 캐시에 이미 있으면 재사용
    if (_translators.containsKey(languageCode)) {
      return _translators[languageCode];
    }

    // ML Kit의 BCP-47 태그로 변환
    final sourceTag = _toBcp47(languageCode);
    if (sourceTag == null) return null; // 지원하지 않는 언어

    // 한국어 타겟 태그
    const targetTag = TranslateLanguage.korean;

    // 소스 언어 모델이 없으면 자동 다운로드 시도
    final isDownloaded = await _modelManager.isModelDownloaded(sourceTag);
    if (!isDownloaded) {
      // 모델 다운로드 (인터넷 필요)
      await _modelManager.downloadModel(sourceTag);
    }

    // 한국어 모델도 확인 및 다운로드
    final isKoDownloaded = await _modelManager.isModelDownloaded(targetTag);
    if (!isKoDownloaded) {
      await _modelManager.downloadModel(targetTag);
    }

    // 새 번역기 생성 (소스 언어 → 한국어)
    final translator = OnDeviceTranslator(
      sourceLanguage: sourceTag, // 출발 언어
      targetLanguage: targetTag, // 도착 언어 (한국어)
    );

    // 캐시에 저장
    _translators[languageCode] = translator;

    return translator; // 번역기 반환
  }

  /// 텍스트의 언어를 간단히 자동 감지
  /// 유니코드 범위를 기반으로 판별합니다
  String _detectLanguage(String text) {
    // 각 문자를 검사하여 어떤 언어인지 추정
    int jaCount = 0; // 일본어 문자 수
    int zhCount = 0; // 중국어 문자 수
    int thCount = 0; // 태국어 문자 수
    int koCount = 0; // 한국어 문자 수
    int viCount = 0; // 베트남어 특수문자 수
    int latinCount = 0; // 라틴 문자(영어 등) 수
    int totalLetters = 0; // 전체 문자 수 (공백, 숫자 제외)

    for (final codeUnit in text.runes) {
      // 히라가나 (ぁ-ん): 일본어
      if (codeUnit >= 0x3040 && codeUnit <= 0x309F) {
        jaCount++;
        totalLetters++;
      }
      // 가타카나 (ァ-ヺ): 일본어
      else if (codeUnit >= 0x30A0 && codeUnit <= 0x30FF) {
        jaCount++;
        totalLetters++;
      }
      // 한자 (CJK Unified): 중국어 또는 일본어
      else if (codeUnit >= 0x4E00 && codeUnit <= 0x9FFF) {
        zhCount++; // 일단 중국어로 분류
        totalLetters++;
      }
      // 한글 (가-힣): 한국어
      else if (codeUnit >= 0xAC00 && codeUnit <= 0xD7AF) {
        koCount++;
        totalLetters++;
      }
      // 태국어 (ก-๛)
      else if (codeUnit >= 0x0E00 && codeUnit <= 0x0E7F) {
        thCount++;
        totalLetters++;
      }
      // 베트남어 특수 모음 (ơ, ư, ă 등의 조합 부호)
      else if (codeUnit >= 0x0300 && codeUnit <= 0x036F) {
        viCount++;
      }
      // 라틴 문자 (A-Z, a-z 및 확장)
      else if ((codeUnit >= 0x0041 && codeUnit <= 0x005A) || // A-Z
          (codeUnit >= 0x0061 && codeUnit <= 0x007A) || // a-z
          (codeUnit >= 0x00C0 && codeUnit <= 0x024F)) {
        // 확장 라틴
        latinCount++;
        totalLetters++;
      }
    }

    // 문자가 없으면 영어로 기본 설정
    if (totalLetters == 0) return 'en';

    // 한국어가 많으면 한국어
    if (koCount > totalLetters * 0.3) return 'ko';

    // 히라가나/가타카나가 있으면 일본어 (한자만 있으면 중국어)
    if (jaCount > 0) return 'ja';

    // 태국어 문자가 많으면 태국어
    if (thCount > totalLetters * 0.3) return 'th';

    // 한자만 있고 일본어 문자가 없으면 중국어
    if (zhCount > totalLetters * 0.3) return 'zh';

    // 베트남어 특수 부호가 있으면 베트남어
    if (viCount > 0 && latinCount > 0) return 'vi';

    // 나머지 라틴 문자는 영어로 분류
    return 'en';
  }

  /// 간단한 언어 코드를 ML Kit의 BCP-47 태그로 변환
  /// 예: 'en' → TranslateLanguage.english
  String? _toBcp47(String code) {
    // ML Kit이 사용하는 BCP-47 태그 매핑
    const map = {
      'en': TranslateLanguage.english,
      'ja': TranslateLanguage.japanese,
      'zh': TranslateLanguage.chinese,
      'th': TranslateLanguage.thai,
      'vi': TranslateLanguage.vietnamese,
      'es': TranslateLanguage.spanish,
      'fr': TranslateLanguage.french,
      'de': TranslateLanguage.german,
      'it': TranslateLanguage.italian,
      'pt': TranslateLanguage.portuguese,
      'id': TranslateLanguage.indonesian,
      'ms': TranslateLanguage.malay,
      'tl': TranslateLanguage.tagalog,
      'ko': TranslateLanguage.korean,
    };

    return map[code]; // 매핑된 태그 반환 (없으면 null)
  }

  /// 리소스 정리 메서드
  /// 앱 종료 시 호출하여 모든 번역기 메모리 해제
  void dispose() {
    // 캐시된 모든 번역기 종료
    for (final translator in _translators.values) {
      translator.close(); // 각 번역기 종료
    }
    _translators.clear(); // 캐시 비우기
  }
}
