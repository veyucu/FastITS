// Decompiled with JetBrains decompiler
// Type: PtsGonderme.NHLService.PullDatas_CompleteCompletedEventArgs
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;

#nullable disable
namespace PtsGonderme.NHLService
{
  [GeneratedCode("System.Web.Services", "4.8.4084.0")]
  [DebuggerStepThrough]
  [DesignerCategory("code")]
  public class PullDatas_CompleteCompletedEventArgs : AsyncCompletedEventArgs
  {
    private object[] results;

    internal PullDatas_CompleteCompletedEventArgs(
      object[] results,
      Exception exception,
      bool cancelled,
      object userState)
      : base(exception, cancelled, userState)
    {
      this.results = results;
    }

    public Pull_CompleteResult Result
    {
      get
      {
        this.RaiseExceptionIfNecessary();
        return (Pull_CompleteResult) this.results[0];
      }
    }
  }
}
